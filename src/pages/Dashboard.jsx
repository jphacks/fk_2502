import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const RED = 'rgb(186, 73, 73)';
const LIGHT_GRAY = '#f8f9fa';
const DARK_GRAY = '#6c757d';
const SUCCESS_GREEN = '#28a745';
const WHITE = '#ffffff';
const PRIMARY_RED = 'rgb(186, 73, 73)';
const LIGHT_BACKGROUND = '#f8f9fa';
const TEXT_DARK = '#333333';
const TEXT_MEDIUM = '#6c757d';
const TEXT_LIGHT = '#adb5bd';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const { user } = useAuth();
  const [medications, setMedications] = useState([]);
  const [todos, setTodos] = useState([]);
  const [weeklyData, setWeeklyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Notification scheduling refs
  const notifyTimersRef = useRef({}); // { [todoId]: timeoutId }
  const notifiedRef = useRef(new Set()); // track which todos already notified for today

  // Base URL for your Flask notify endpoint.
  // On Android emulator use 10.0.2.2 -> points to host localhost. iOS simulator and web use localhost.
  const NOTIFY_BASE = Platform.OS === 'android' ? 'http://10.0.2.2:6000' : 'http://localhost:6000';
  const NOTIFY_URL = `${NOTIFY_BASE}/notify`;

  const progress = todos.length > 0 ? todos.filter(todo => todo.completed).length / todos.length : 0;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const tickAnimation = useRef(new Animated.Value(0)).current;
  const [showTick, setShowTick] = useState(false);

  // Fetch medications and sync data from Firebase
  useEffect(() => {
    if (!user) return;

    console.log('🔍 Dashboard: Fetching tracking data for user:', user.uid);
    const trackingRef = doc(db, 'tracking', user.uid);
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(trackingRef, async (docSnap) => {
      console.log('📊 Dashboard: Snapshot received at', new Date().toLocaleTimeString());
      
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('✅ Dashboard: Tracking data exists');
          console.log('📦 Dashboard: Raw medications count:', data.medications?.length || 0);
          
          const activeMeds = (data.medications || []).filter(med => med.status === 'active');
          console.log('🟢 Dashboard: Active medications count:', activeMeds.length);
          
          // Only process medications that are within their active date range
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const validMeds = activeMeds.filter(med => {
            // Parse dates as local dates (YYYY-MM-DD format)
            const startDate = new Date(med.startDate + 'T00:00:00');
            const endDate = new Date(med.endDate + 'T23:59:59');
            
            // Check if dates are valid
            const isStartValid = !isNaN(startDate.getTime());
            const isEndValid = !isNaN(endDate.getTime());
            
            console.log(`🔍 ${med.pillName}: start=${med.startDate}, end=${med.endDate}, inRange=${isStartValid && isEndValid && today >= startDate && today <= endDate}`);
            
            // Only include if dates are valid and in range
            return isStartValid && isEndValid && today >= startDate && today <= endDate;
          });
          
          console.log('✅ Dashboard: Valid medications after filter:', validMeds.length);
          
          // Update state first
          setMedications(validMeds);
          
          // Then generate todos and weekly data with the new medications
          await Promise.all([
            generateTodosFromMedications(validMeds),
            generateWeeklyData(validMeds)
          ]);
          
          console.log('✅ Dashboard: All data refreshed successfully');
        } else {
          console.log('❌ Dashboard: No tracking document found');
          setMedications([]);
          setTodos([]);
          setWeeklyData(getEmptyWeeklyData([]));
        }
      } catch (error) {
        console.error('❌ Error in snapshot listener:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (progress === 1) {
      // Show tick animation when 100% complete
      setTimeout(() => {
        setShowTick(true);
        Animated.spring(tickAnimation, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }, 300);
    } else {
      setShowTick(false);
      tickAnimation.setValue(0);
    }
  }, [progress]);

  // Generate empty weekly data structure
  const getEmptyWeeklyData = (meds) => {
    // Use sum instead of max to show total doses per day
    const pillCount = meds.reduce((sum, med) => sum + (med.dosage || 1), 0);
    return {
      sun: Array(pillCount).fill(false),
      mon: Array(pillCount).fill(false),
      tue: Array(pillCount).fill(false),
      wed: Array(pillCount).fill(false),
      thu: Array(pillCount).fill(false),
      fri: Array(pillCount).fill(false),
      sat: Array(pillCount).fill(false),
    };
  };

  // Generate today's todos from medications
  const generateTodosFromMedications = async (meds) => {
    if (!user || meds.length === 0) {
      setTodos([]);
      return;
    }

    const today = new Date();
    // Format date as YYYY-MM-DD in local timezone
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    // Fetch today's taken status from Firebase
    const takenRef = doc(db, 'taken', `${user.uid}_${todayStr}`);
    const takenDoc = await getDoc(takenRef);
    const takenData = takenDoc.exists() ? takenDoc.data().pills || {} : {};
    
    const newTodos = [];
    meds.forEach(med => {
      med.timeSlots.forEach((timeSlot, index) => {
        const todoId = `${med.medicationId}_${timeSlot}`;
        const isTaken = takenData[todoId] || false;
        
        newTodos.push({
          id: todoId,
          medicationId: med.medicationId,
          text: med.pillName,
          time: formatTimeSlot(timeSlot),
          timeSlot: timeSlot,
          completed: isTaken,
        });
      });
    });
    
    // Sort by time
    newTodos.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    setTodos(newTodos);
  };

  // Format time slot (HH:mm to 12-hour format)
  const formatTimeSlot = (timeSlot) => {
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Generate weekly data
  const generateWeeklyData = async (meds) => {
    console.log('📊 Generating weekly data for meds:', meds);
    
    if (!user || meds.length === 0) {
      console.log('⚠️ No meds or user, setting empty weekly data');
      setWeeklyData(getEmptyWeeklyData([]));
      return;
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    // Format date as YYYY-MM-DD in local timezone
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    console.log('📅 Today:', formatLocalDate(today), 'Day of week:', dayOfWeek);
    console.log('📅 Week starts on:', formatLocalDate(weekStart));
    
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    // Calculate total doses per day (sum of all medications)
    const totalDosesPerDay = meds.reduce((sum, med) => sum + (med.dosage || 1), 0);
    console.log('💊 Total doses per day:', totalDosesPerDay);
    
    const weekly = {};
    
    // Fetch taken data for the week
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = formatLocalDate(date);
      
      const takenRef = doc(db, 'taken', `${user.uid}_${dateStr}`);
      const takenDoc = await getDoc(takenRef);
      const takenData = takenDoc.exists() ? takenDoc.data().pills || {} : {};
      
      // Count how many pills were taken that day
      const takenCount = Object.values(takenData).filter(Boolean).length;
      console.log(`📅 ${days[i]} (${dateStr}): ${takenCount}/${totalDosesPerDay} taken`, takenData);
      
      const dayArray = Array(totalDosesPerDay).fill(false);
      
      // Mark pills as taken
      for (let j = 0; j < Math.min(takenCount, totalDosesPerDay); j++) {
        dayArray[j] = true;
      }
      
      weekly[days[i]] = dayArray;
    }
    
    console.log('✅ Weekly data generated:', weekly);
    setWeeklyData(weekly);
  };

  // Toggle todo completion
  const toggleTodo = async (todoId) => {
    if (!user) return;
    
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    
    console.log('🔄 Toggling todo:', todoId, 'Current state:', todo.completed);
    
    // Clear any scheduled notification for this todo (user already took it / toggled it)
    if (notifyTimersRef.current[todoId]) {
      clearTimeout(notifyTimersRef.current[todoId]);
      delete notifyTimersRef.current[todoId];
    }
    // Mark as notified so we don't notify again for today
    notifiedRef.current.add(todoId);

    const today = new Date();
    // Format date as YYYY-MM-DD in local timezone
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    // Update local state immediately for better UX
    setTodos(todos.map(t => 
      t.id === todoId ? { ...t, completed: !t.completed } : t
    ));
    
    // Update Firebase
    const takenRef = doc(db, 'taken', `${user.uid}_${todayStr}`);
    const takenDoc = await getDoc(takenRef);
    const currentData = takenDoc.exists() ? takenDoc.data().pills || {} : {};
    
    currentData[todoId] = !todo.completed;
    
    console.log('💾 Saving to Firebase:', { date: todayStr, pills: currentData });
    
    await setDoc(takenRef, {
      userId: user.uid,
      date: todayStr,
      pills: currentData,
      updatedAt: new Date().toISOString(),
    });
    
    console.log('✅ Saved to taken collection, now updating tracking document');
    
    // Update takenCount and lastTaken in tracking document
    const trackingRef = doc(db, 'tracking', user.uid);
    const trackingDoc = await getDoc(trackingRef);
    
    if (trackingDoc.exists()) {
      const trackingData = trackingDoc.data();
      const medications = trackingData.medications || [];
      
      // Find the medication and update takenCount
      const updatedMeds = medications.map(med => {
        if (med.medicationId === todo.medicationId) {
          const newTakenCount = !todo.completed 
            ? (med.takenCount || 0) + 1 
            : Math.max((med.takenCount || 0) - 1, 0);
          
          const lastTaken = !todo.completed ? new Date().toISOString() : med.lastTaken;
          
          console.log(`📊 Updating ${med.pillName}:`, {
            oldTakenCount: med.takenCount || 0,
            newTakenCount,
            lastTaken
          });
          
          return {
            ...med,
            takenCount: newTakenCount,
            lastTaken: lastTaken,
            updatedAt: new Date().toISOString(),
          };
        }
        return med;
      });
      
      await setDoc(trackingRef, { medications: updatedMeds }, { merge: true });
      console.log('✅ Updated tracking document - snapshot listener will auto-refresh');
    }
    
    // The snapshot listener will automatically trigger and update everything
    // No need to manually call generateWeeklyData - it will happen via the listener
  };

  const onRefresh = async () => {
    console.log('🔄 Dashboard: Pull to refresh triggered');
    setRefreshing(true);
    
    if (!user) {
      setRefreshing(false);
      return;
    }
    
    try {
      // Manually fetch the latest data
      console.log('📥 Fetching fresh data from Firebase...');
      const trackingRef = doc(db, 'tracking', user.uid);
      const docSnap = await getDoc(trackingRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('✅ Dashboard: Tracking data exists:', data);
        console.log('📦 Dashboard: Raw medications:', data.medications);
        
        const activeMeds = (data.medications || []).filter(med => med.status === 'active');
        console.log('🟢 Dashboard: Active medications:', activeMeds);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        console.log('📅 Dashboard: Today (midnight):', today.toISOString());
        
        const validMeds = activeMeds.filter(med => {
          // Parse dates as local dates (YYYY-MM-DD format)
          const startDate = new Date(med.startDate + 'T00:00:00');
          const endDate = new Date(med.endDate + 'T23:59:59');
          
          const isStartValid = !isNaN(startDate.getTime());
          const isEndValid = !isNaN(endDate.getTime());
          
          console.log(`🔍 Checking ${med.pillName}:`, {
            startDateStr: med.startDate,
            endDateStr: med.endDate,
            parsedStart: isStartValid ? startDate.toISOString() : 'INVALID DATE',
            parsedEnd: isEndValid ? endDate.toISOString() : 'INVALID DATE',
            todayStr: today.toISOString(),
            isStartValid,
            isEndValid,
            isInRange: isStartValid && isEndValid ? (today >= startDate && today <= endDate) : false
          });
          
          return isStartValid && isEndValid && today >= startDate && today <= endDate;
        });
        
        console.log('✅ Dashboard: Valid medications after date filter:', validMeds);
        
        setMedications(validMeds);
        await generateTodosFromMedications(validMeds);
        await generateWeeklyData(validMeds);
      } else {
        console.log('❌ Dashboard: No tracking document found');
        setMedications([]);
        setTodos([]);
        setWeeklyData(getEmptyWeeklyData([]));
      }
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getCurrentDay = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const getGreeting = () => {
    if (progress === 0) return "Don't forget to take your pills today! 💊";
    if (progress === 1) return "Great job! All pills taken! 🎉";
    if (progress >= 0.5) return "You're doing great! Keep it up! 💪";
    return "Let's get started with your medications! 💊";
  };

  const getProgressColor = () => {
    if (progress === 1) return SUCCESS_GREEN;
    if (progress >= 0.6) return '#ffc107';
    return RED;
  };

  // When todos change schedule notifications for upcoming times
  useEffect(() => {
    // clear existing timers first
    Object.values(notifyTimersRef.current).forEach(id => clearTimeout(id));
    notifyTimersRef.current = {};

    if (!todos || todos.length === 0) return;

    const now = new Date();

    todos.forEach(todo => {
      // Only schedule for not completed items and not already notified
      if (todo.completed || notifiedRef.current.has(todo.id)) return;

      // Parse todo.timeSlot (expected "HH:mm")
      const [hStr, mStr] = (todo.timeSlot || '00:00').split(':');
      const target = new Date();
      target.setHours(Number(hStr), Number(mStr), 0, 0);

      const msUntil = target.getTime() - now.getTime();

      // If time is in the future, schedule; if it's past and not completed, notify immediately
      if (msUntil > 0) {
        const id = setTimeout(() => {
          sendNotify(todo);
          notifiedRef.current.add(todo.id);
          delete notifyTimersRef.current[todo.id];
        }, msUntil);
        notifyTimersRef.current[todo.id] = id;
        console.log(`⏱ Scheduled notify for ${todo.id} in ${Math.round(msUntil/1000)}s`);
      } else {
        // if it's already past and not completed, notify right away
        console.log(`🔔 Time passed for ${todo.id}, sending immediate notify`);
        sendNotify(todo);
        notifiedRef.current.add(todo.id);
      }
    });

    return () => {
      Object.values(notifyTimersRef.current).forEach(id => clearTimeout(id));
      notifyTimersRef.current = {};
    };
  }, [todos]);

  // Fire the notify endpoint (no payload required by your Flask endpoint)
  const sendNotify = async (todo) => {
    try {
      console.log('📣 Sending notify for', todo.id, 'to', NOTIFY_URL);
      await fetch(NOTIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // optional helpful body for server logs
        body: JSON.stringify({
          title: 'PillPal Reminder',
          message: `Time to take: ${todo.text} (${todo.time})`,
          todoId: todo.id,
        })
      });
      console.log('✅ Notify sent for', todo.id);
    } catch (err) {
      console.error('❌ Failed to call notify endpoint', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_RED} />
        <Text style={styles.loadingText}>Loading your medications...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[PRIMARY_RED]}
          tintColor={PRIMARY_RED}
        />
      }
    >
      {/* Header with 2 columns */}
      <View style={styles.header}>
        {/* Left Column - Day and Greeting */}
        <View style={styles.leftColumn}>
          <Text style={styles.dayText}>{getCurrentDay()}</Text>
          <Text style={styles.greetingText}>{getGreeting()}</Text>
          <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
        </View>
        
        {/* Right Column - Progress Circle */}
        <View style={styles.rightColumn}>
          <View style={styles.progressCircle}>
            {/* Background circle */}
            <View style={styles.progressBackground} />
            
            {/* Progress fill - only show when progress > 0 */}
            {progress > 0 && progress < 1 && (
              <Animated.View 
                style={[
                  styles.progressFill,
                  {
                    transform: [{
                      rotate: progressAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-90deg', '270deg'],
                      })
                    }]
                  }
                ]}
              />
            )}
            
            {/* Full red circle when 100% complete */}
            {progress === 1 && (
              <View style={styles.progressComplete} />
            )}
            
            <View style={styles.progressInner}>
              {progress === 1 && showTick ? (
                <Animated.View
                  style={{
                    transform: [{
                      scale: tickAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1.2],
                      })
                    }]
                  }}
                >
                  <Text style={styles.tickMark}>✓</Text>
                </Animated.View>
              ) : (
                <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
              )}
            </View>
          </View>
          <Text style={styles.progressLabel}>Daily Progress</Text>
        </View>
      </View>

      {/* To Do List */}
      <View style={styles.todoContainer}>
        <Text style={styles.sectionTitle}>Today's Medications</Text>
        {todos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>💊</Text>
            <Text style={styles.emptyStateTitle}>No medications scheduled</Text>
            <Text style={styles.emptyStateSubtitle}>
              Scan a prescription to add your medications
            </Text>
          </View>
        ) : (
          todos.map((todo) => (
            <TouchableOpacity
              key={todo.id}
              style={[styles.todoItem, todo.completed && styles.todoItemCompleted]}
              onPress={() => toggleTodo(todo.id)}
              activeOpacity={0.7}
            >
              <View style={styles.todoLeft}>
                <View style={[styles.checkbox, todo.completed && styles.checkboxCompleted]}>
                  {todo.completed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.todoContent}>
                  <Text style={[styles.todoText, todo.completed && styles.todoTextCompleted]}>
                    {todo.text}
                  </Text>
                  <Text style={[styles.todoTime, todo.completed && styles.todoTimeCompleted]}>
                    {todo.time}
                  </Text>
                </View>
              </View>
              {todo.completed && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedText}>Done</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Weekly Tracker */}
      <View style={styles.weeklyContainer}>
        <Text style={styles.sectionTitle}>Weekly Tracker</Text>
        {weeklyData && Object.keys(weeklyData).length > 0 ? (
          <View style={styles.weeklyGrid}>
            {Object.entries(weeklyData).map(([day, pills], index) => (
              <View key={day} style={styles.dayColumn}>
                <Text style={styles.dayLabel}>{day.toUpperCase().slice(0, 3)}</Text>
                <View style={styles.pillsContainer}>
                  {pills.map((completed, pillIndex) => (
                    <View
                      key={pillIndex}
                      style={[
                        styles.pillIndicator,
                        completed && styles.pillIndicatorCompleted
                      ]}
                    >
                      {completed && <Text style={styles.pillCheckmark}>✓</Text>}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📅</Text>
            <Text style={styles.emptyStateTitle}>No tracking data yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start taking your medications to see weekly progress
            </Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_BACKGROUND,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 20,
  },
  leftColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  rightColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: PRIMARY_RED,
    marginBottom: 8,
  },
  greetingText: {
    fontSize: 20,
    color: TEXT_MEDIUM,
    marginBottom: 4,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  progressCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  progressBackground: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    borderColor: '#e9ecef',
  },
  progressFill: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopColor: PRIMARY_RED,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  progressComplete: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    borderColor: PRIMARY_RED,
  },
  tickMark: {
    color: SUCCESS_GREEN,
    fontSize: 50,
    fontWeight: 'bold',
  },
  progressInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: LIGHT_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_RED,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MEDIUM,
  },
  todoContainer: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginBottom: 15,
  },
  todoItem: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  todoItemCompleted: {
    backgroundColor: LIGHT_BACKGROUND,
    opacity: 0.8,
  },
  todoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: TEXT_MEDIUM,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxCompleted: {
    backgroundColor: SUCCESS_GREEN,
    borderColor: SUCCESS_GREEN,
  },
  checkmark: {
    color: WHITE,
    fontSize: 16,
    fontWeight: 'bold',
  },
  todoContent: {
    flex: 1,
  },
  todoText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 4,
  },
  todoTextCompleted: {
    textDecorationLine: 'line-through',
    color: TEXT_MEDIUM,
  },
  todoTime: {
    fontSize: 14,
    color: TEXT_MEDIUM,
  },
  todoTimeCompleted: {
    color: TEXT_LIGHT,
  },
  completedBadge: {
    backgroundColor: SUCCESS_GREEN,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '600',
  },
  weeklyContainer: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  weeklyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MEDIUM,
    marginBottom: 8,
  },
  pillsContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  pillIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillIndicatorCompleted: {
    backgroundColor: SUCCESS_GREEN,
  },
  pillCheckmark: {
    color: WHITE,
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: LIGHT_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: TEXT_MEDIUM,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: TEXT_MEDIUM,
    textAlign: 'center',
    lineHeight: 20,
  },
});