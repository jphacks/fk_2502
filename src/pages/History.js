import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';

const RED = 'rgb(186, 73, 73)';

export default function History() {
  const { user } = useAuth();
  const [pills, setPills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'pills'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Firestore snapshot received:', snapshot.docs.length, 'documents');
      const pillsData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Pill data:', data);
        return {
          id: doc.id,
          ...data
        };
      });
      console.log('Processed pills data:', pillsData);
      setPills(pillsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching pills:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate();
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const renderPillItem = ({ item }) => (
    <TouchableOpacity style={styles.pillCard} onPress={() => showPillDetails(item)}>
      <View style={styles.pillCardContent}>
        {/* Header */}
        <View style={styles.pillHeader}>
          <View style={styles.medicineInfo}>
            <Text style={styles.medicineName}>{item.medicineName}</Text>
            <Text style={styles.medicineType}>Prescription</Text>
          </View>
          <View style={styles.dateContainer}>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Analyzed</Text>
            </View>
          </View>
        </View>
        
        {/* Details */}
        <View style={styles.pillDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Dosage</Text>
            <Text style={styles.detailValue}>{item.dosage}</Text>
          </View>
          <View style={styles.pillDetails}>
            <Text style = {styles.detailLabel}>Duration</Text>
            <Text style = {styles.detailLabel}>{item.startDate} ~ {item.endDate}</Text>
            
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Instructions</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {item.instructions}
            </Text>
          </View>
        </View>
        
        {/* Image and Action */}
        <View style={styles.pillFooter}>
          {item.imageUrl && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} />
            </View>
          )}
          <View style={styles.actionContainer}>
            <Text style={styles.viewDetailsText}>View Details →</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const showPillDetails = (pill) => {
    Alert.alert(
      pill.medicineName,
      `Dosage: ${pill.dosage}\n\nInstructions: ${pill.instructions}\n\nAnalyzed: ${formatDate(pill.analyzedAt)}`,
      [
        { text: 'Close', style: 'cancel' },
        ...(pill.imageUrl ? [{ text: 'View Image', onPress: () => showImageModal(pill.imageUrl) }] : [])
      ]
    );
  };

  const showImageModal = (imageUrl) => {
    Alert.alert(
      'Prescription Image',
      'View the scanned prescription image',
      [
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingSpinner} />
          <Text style={styles.loadingTitle}>Loading History...</Text>
          <Text style={styles.loadingSubtitle}>Fetching your medication records</Text>
          <Text style={styles.debugText}>User ID: {user?.uid || 'No user'}</Text>
        </View>
      </View>
    );
  }

  if (pills.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>💊</Text>
          </View>
          <Text style={styles.emptyTitle}>No Medications Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start by taking a photo of your prescription to analyze and track your medications.
          </Text>
          <View style={styles.emptyStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Medications</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Analyses</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Medication List */}
      <FlatList
        data={pills}
        renderItem={renderPillItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 80,
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadingSpinner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#e0f2fe',
    borderTopColor: '#0ea5e9',
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  debugText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#bae6fd',
  },
  emptyIcon: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0ea5e9',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 20,
  },

  // Header
  header: {
    backgroundColor: 'transparent',
    paddingTop: 60,
    paddingBottom: 0,
  },
  headerGradient: {
    backgroundColor: 'rgba(14, 165, 233, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },

  // Page Title
  pageTitleContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'white',
    marginTop: -12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '400',
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },

  // Pill Cards
  pillCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillCardContent: {
    padding: 16,
  },
  pillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  medicineInfo: {
    flex: 1,
    marginRight: 16,
  },
  medicineName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  medicineType: {
    fontSize: 14,
    color: '#0ea5e9',
    fontWeight: '500',
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  date: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  pillDetails: {
    marginBottom: 12,
  },
  detailRow: {
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 24,
  },
  pillFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  actionContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#0ea5e9',
    fontWeight: '600',
  },
});



