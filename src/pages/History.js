import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, TextInput, Modal } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';
import QRCode from 'react-native-qrcode-svg';

const RED = 'rgb(186, 73, 73)';
const USE_DUMMY = true;

export default function History() {
  const { user } = useAuth();
  const [pills, setPills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Correctly reference the single document belonging to the user
    const docRef = doc(db, 'history', user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data() || {};
          // The document's data contains the medications array
          const meds = (data.medications || []).map(m => ({
            id: m.medicationId || `${docSnap.id}_${m.pillName}`,
            medicineName: m.pillName,
            dosage: m.dosage ?? m.dosageInfo ?? '',
            instructions: m.instructions ?? '',
            imageUrl: m.imageUrl ?? null,
            startDate: m.startDate ?? null,
            endDate: m.endDate ?? null,
            duration: m.duration ?? null,
            analyzedAt: m.scannedAt ?? null,
            createdAt: m.scannedAt ?? m.createdAt ?? new Date().toISOString(),
          }));
          setPills(meds);
        } else {
          // Handle case where the user has no history document yet
          console.log("No history document found for this user.");
          setPills([]);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error processing history snapshot:', err);
        setLoading(false);
      }
    }, (error) => {
      console.error('Error fetching history:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Derived filtered list (case-insensitive search across medicineName, dosage, instructions)
  const filteredPills = useMemo(() => {
    if (!searchQuery?.trim()) return pills;
    const q = searchQuery.trim().toLowerCase();
    const normalize = (v) => {
      if (v == null) return '';
      if (typeof v === 'string') return v.toLowerCase();
      try { return String(v).toLowerCase(); } catch { return ''; }
    };
    return pills.filter(p => {
      const name = normalize(p.medicineName);
      const dosage = normalize(p.dosage);
      const instr = normalize(p.instructions);
      return name.includes(q) || dosage.includes(q) || instr.includes(q);
    });
  }, [pills, searchQuery]);

  // Generate data for QR code
  const generateQRData = () => {
    const medicationData = pills.map(pill => ({
      name: pill.medicineName,
      dosage: pill.dosage,
      instructions: pill.instructions,
      duration: pill.duration,
      analyzedAt: pill.analyzedAt
    }));

    // Create a URL with the data encoded
    const encodedData = encodeURIComponent(JSON.stringify(medicationData));
    // You would replace this with your actual web viewer URL
    return `https://medication-history-viewer.web.app/?data=${encodedData}`;
  };

  // QR Code Modal
  const renderQRCodeModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showQRCode}
      onRequestClose={() => setShowQRCode(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Scan QR Code</Text>
          <Text style={styles.modalSubtitle}>Scan this code to view medication history</Text>
          <View style={styles.qrContainer}>
            <QRCode
              value={generateQRData()}
              size={250}
              backgroundColor="white"
              color="black"
            />
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowQRCode(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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
            <Text style = {styles.detailLabel}>{item.duration}</Text>
            
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
      {/* QR Code Modal */}
      {renderQRCodeModal()}
      
      {/* Search bar above the medicine cards */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => setShowQRCode(true)}
        >
          <Text style={styles.qrButtonText}>QR</Text>
        </TouchableOpacity>
      </View>
       {/* Medication List */}
       <FlatList
        data={filteredPills}
         renderItem={renderPillItem}
         keyExtractor={(item) => item.id}
         style={styles.list}
         contentContainerStyle={styles.listContent}
         showsVerticalScrollIndicator={false}
       />
     </View>
   );
 }
 
 // Helper: safe date formatter used by History
 const formatDate = (value) => {
   if (!value) return '';
   try {
     const d = value instanceof Date
       ? value
       : (typeof value === 'number' ? new Date(value) : new Date(value));
     if (isNaN(d.getTime())) return '';
     return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
   } catch (e) {
     return '';
   }
 };
 
 const styles = StyleSheet.create({
   // Main Container
   container: {
     flex: 1,
     backgroundColor: '#f8fafc',
     paddingTop: 80,
   },
   searchContainer: {
     paddingHorizontal: 16,
     paddingBottom: 8,
     flexDirection: 'row',
     alignItems: 'center',
     backgroundColor: 'transparent',
   },
   searchInput: {
     flex: 1,
     backgroundColor: 'white',
     borderRadius: 12,
     paddingHorizontal: 12,
     paddingVertical: 10,
     borderWidth: 1,
     borderColor: '#e2e8f0',
     fontSize: 16,
   },
   clearButton: {
     marginLeft: 8,
     padding: 8,
     justifyContent: 'center',
     alignItems: 'center',
   },
   clearButtonText: {
     fontSize: 18,
     color: '#64748b',
   },
   qrButton: {
     marginLeft: 8,
     padding: 8,
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: '#0ea5e9',
     borderRadius: 8,
   },
   qrButtonText: {
     fontSize: 16,
     color: 'white',
     fontWeight: '600',
   },

   // Modal
   modalContainer: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
   },
   modalContent: {
     backgroundColor: 'white',
     borderRadius: 16,
     padding: 24,
     alignItems: 'center',
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.1,
     shadowRadius: 8,
     elevation: 8,
   },
   modalTitle: {
     fontSize: 20,
     fontWeight: '600',
     color: '#1e293b',
     marginBottom: 8,
   },
   modalSubtitle: {
     fontSize: 14,
     color: '#64748b',
     textAlign: 'center',
     marginBottom: 16,
   },
   qrContainer: {
     marginBottom: 16,
   },
   closeButton: {
     backgroundColor: '#0ea5e9',
     borderRadius: 8,
     paddingHorizontal: 16,
     paddingVertical: 8,
   },
   closeButtonText: {
     fontSize: 16,
     color: 'white',
     fontWeight: '600',
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



