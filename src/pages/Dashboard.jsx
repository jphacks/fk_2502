import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
  const [todos, setTodos] = useState([
    { id: 1, text: 'Morning Pill', completed: false, time: '8:00 AM' },
    { id: 2, text: 'Afternoon Pill', completed: false, time: '2:00 PM' },
    { id: 3, text: 'Evening Pill', completed: false, time: '8:00 PM' },
  ]);
  const [weeklyData, setWeeklyData] = useState({
    sun: [false, false],
    mon: [false, false],
    tue: [false, false],
    wed: [false, false],
    thu: [false, false],
    fri: [false, false],
    sat: [false, false],
  });

  const progress = todos.filter(todo => todo.completed).length / todos.length;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const tickAnimation = useRef(new Animated.Value(0)).current;
  const [showTick, setShowTick] = useState(false);

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

  const toggleTodo = (id) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
        {todos.map((todo) => (
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
        ))}
      </View>

      {/* Weekly Tracker */}
      <View style={styles.weeklyContainer}>
        <Text style={styles.sectionTitle}>Weekly Tracker</Text>
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
});