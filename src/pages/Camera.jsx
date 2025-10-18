import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, getDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { storage, db } from '../firebaseConfig';
import MedicineInfoPopup from '../components/MedicineInfoPopup';

const RED = 'rgb(186, 73, 73)';

export default function Camera() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [capturedImage, setCapturedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [uploadedImageRef, setUploadedImageRef] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [isSavedToHistory, setIsSavedToHistory] = useState(false);
  const [showMedicinePopup, setShowMedicinePopup] = useState(false);
  const [medicineData, setMedicineData] = useState(null);
  const cameraRef = useRef(null);

  // Automatically request permission when component mounts
  useEffect(() => {
    if (permission && !permission.granted && !hasRequestedPermission) {
      setHasRequestedPermission(true);
      // Small delay to ensure UI is ready
      setTimeout(() => {
        requestPermission();
      }, 500);
    }
  }, [permission, hasRequestedPermission, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingSpinner} />
          <Text style={styles.loadingTitle}>Initializing Camera...</Text>
          <Text style={styles.loadingSubtitle}>Please wait while we set up your camera</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.iconContainer}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            PillPal needs camera access to scan and identify your medications. 
            This helps us provide accurate analysis and keep track of your prescriptions.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <Text style={styles.permissionHelpText}>
            If the permission dialog doesn't appear, please check your device settings.
          </Text>
        </View>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        console.log('Taking picture...');
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        console.log('Picture taken successfully:', photo.uri);
        setCapturedImage(photo.uri);
        console.log('Captured image state set to:', photo.uri);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    } else {
      console.error('Camera ref is null');
    }
  };

  const handleCloseMedicinePopup = () => {
    // User cancelled - just close popup and reset to camera
    setShowMedicinePopup(false);
    setMedicineData(null);
    setCapturedImage(null);
  };

  const retakePicture = () => {
    // Reset everything for a new capture
    setCapturedImage(null);
    setAnalysisResult(null);
    setShowResults(false);
    setIsSavedToHistory(false);
    setShowMedicinePopup(false);
    setMedicineData(null);
  };

  const closeResults = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setShowResults(false);
    setUploadedImageRef(null);
    setUploadedImageUrl(null);
    setIsSavedToHistory(false);
  };

  const deleteImageAndSkipHistory = async () => {
    try {
      if (uploadedImageRef) {
        await deleteObject(uploadedImageRef);
        console.log('Image deleted from Firebase Storage');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
    
    // Clear the uploaded image references
    setUploadedImageRef(null);
    setUploadedImageUrl(null);
    setIsSavedToHistory(false);
  };

  const saveToHistory = async (analysisResult, downloadURL) => {
    try {
      // Step 5: Save complete record to Firestore for history
      const pillId = `pill_${Date.now()}`;
      const historyRecord = {
        id: pillId,
        userId: user.uid,
        imageUrl: downloadURL, // Use Firebase Storage URL for history
        localImageUri: capturedImage, // Keep local URI for reference
        createdAt: serverTimestamp(),
        status: 'analyzed',
        analysisResult: analysisResult,
        analyzedAt: serverTimestamp(),
        // Add structured data for easy display in history
        medicineName: analysisResult.name || analysisResult.medicine || 'Unknown',
        dosage: analysisResult.times_per_day || analysisResult.dosage || 'Not specified',
        // Add metadata
        source: 'camera',
        apiUsed: 'flask',
      };
      
      await setDoc(doc(db, 'pills', pillId), historyRecord);
      console.log('History record saved:', pillId);
      console.log('History record data:', historyRecord);
      
      setIsSavedToHistory(true);
      Alert.alert('Success', 'Analysis saved to your medication history!');
    } catch (error) {
      console.error('Error saving to history:', error);
      Alert.alert('Error', 'Failed to save to history. Please try again.');
    }
  };

  const handleSaveMedicine = async (scheduleData) => {
    if (!user || !capturedImage) return;
    
    try {
      console.log('Saving medicine with schedule:', scheduleData);
      
      // Upload image to Firebase Storage now that user confirmed
      console.log('Uploading image to Firebase Storage...');
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const imageRef = ref(storage, `prescriptions/${user.uid}/${Date.now()}.jpg`);
      const uploadResult = await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      console.log('Image uploaded to Storage:', downloadURL);
      
      // Step 1: Generate unique medication ID
      const medicationId = `med_${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      // Step 2: Save to history collection
      const historyRef = doc(db, 'history', user.uid);
      const historyDoc = await getDoc(historyRef);
      
      const historyEntry = {
        medicationId: medicationId,
        pillName: scheduleData.pillName,
        dosageInfo: scheduleData.dosageInfo,
        dosage: scheduleData.dosage,
        duration: scheduleData.duration,
        condition: scheduleData.condition || '',
        instructions: scheduleData.instructions || '',
        sideEffects: scheduleData.sideEffects || [],
        imageUrl: downloadURL,
        scannedAt: timestamp,
        addedToTracking: true,
      };
      
      if (historyDoc.exists()) {
        const existingData = historyDoc.data();
        const medications = existingData.medications || [];
        medications.push(historyEntry);
        await setDoc(historyRef, { medications }, { merge: true });
      } else {
        await setDoc(historyRef, { medications: [historyEntry] });
      }
      console.log('Saved to history collection');
      
      // Step 3: Save to tracking collection
      const trackingRef = doc(db, 'tracking', user.uid);
      const trackingDoc = await getDoc(trackingRef);
      
      const trackingEntry = {
        medicationId: medicationId,
        pillName: scheduleData.pillName,
        dosageInfo: scheduleData.dosageInfo,
        dosage: scheduleData.dosage,
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate,
        timeSlots: scheduleData.timeSlots,
        lastTaken: null,
        nextReminder: scheduleData.nextReminder,
        status: 'active',
        takenCount: 0,
        totalDoses: scheduleData.totalDoses,
        createdAt: timestamp,
        updatedAt: timestamp,
        historyRef: medicationId,
      };
      
      if (trackingDoc.exists()) {
        const existingData = trackingDoc.data();
        const medications = existingData.medications || [];
        medications.push(trackingEntry);
        await setDoc(trackingRef, { medications }, { merge: true });
      } else {
        await setDoc(trackingRef, { medications: [trackingEntry] });
      }
      console.log('Saved to tracking collection');
      
      // Step 4: Close popup and reset
      Alert.alert(
        '✅ Success!', 
        'Your medicine schedule has been saved successfully!',
        [{ text: 'OK', style: 'default' }]
      );
      setShowMedicinePopup(false);
      setMedicineData(null);
      setCapturedImage(null);
      
    } catch (error) {
      console.error('Error saving medicine:', error);
      // Re-throw the error so the loading state in popup can handle it
      throw error;
    }
  };

  const analyzePicture = async () => {
    if (!capturedImage || !user) return;
    
    setIsAnalyzing(true);
    try {
      // Step 1: Convert image to JPEG format (handles HEIC from iPhone)
      console.log('Converting image to JPEG...');
      const manipulatedImage = await manipulateAsync(
        capturedImage,
        [], // No additional manipulations, just format conversion
        { 
          compress: 0.8, 
          format: SaveFormat.JPEG 
        }
      );
      const jpegImageUri = manipulatedImage.uri;
      console.log('Image converted to JPEG:', jpegImageUri);
      
      // Step 2: Send JPEG file directly to API (don't upload to Storage yet)
      const API_URL = 'http://172.20.10.10:6000/process';
      console.log('Sending JPEG file to API:', API_URL);
      
      // Create FormData to send file
      const formData = new FormData();
      formData.append('file', {
        uri: jpegImageUri,
        type: 'image/jpeg',
        name: 'prescription.jpg',
      });
      
      const apiResponse = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let fetch set it automatically with boundary
      });
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`API returned status ${apiResponse.status}: ${errorText}`);
      }
      
      const apiData = await apiResponse.json();
      console.log('API Response:', apiData);
      
      // Step 3: Extract data from response field
      const responseData = apiData.response || apiData;
      console.log('Response data:', responseData);
      
      // Step 4: Transform API response to match our structure
      const medicineData = {
        pillName: responseData.pillName || 'Unknown Medicine',
        dosageInfo: responseData.dosageInfo || '',
        dosage: responseData.dosage || 1,
        duration: responseData.duration ? `${responseData.duration} days` : '7 days',
        condition: responseData.condition || '',
        instructions: responseData.instructions || '',  
        sideEffects: responseData.sideEffects || [],
      };
      
      // Show medicine popup with the data
      setMedicineData(medicineData);
      setIsAnalyzing(false);
      setShowMedicinePopup(true);
      console.log('Medicine popup shown with data:', medicineData);
      
    } catch (error) {
      console.error('Error analyzing picture:', error);
      Alert.alert(
        'Analysis Failed', 
        `Failed to analyze picture: ${error.message}\n\nPlease try again.`
      );
      setIsAnalyzing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const adjustZoom = (direction) => {
    if (direction === 'in' && zoom < 1) {
      setZoom(prev => Math.min(prev + 0.1, 1));
    } else if (direction === 'out' && zoom > 0) {
      setZoom(prev => Math.max(prev - 0.1, 0));
    }
  };

  if (showResults && analysisResult) {
    return (
      <View style={styles.container}>
        <View style={styles.resultsContainer}>
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>📋 Analysis Results</Text>
            
            {/* Show save status */}
            <View style={styles.saveStatusContainer}>
              <Text style={[
                styles.saveStatusText, 
                isSavedToHistory ? styles.savedStatus : styles.notSavedStatus
              ]}>
                {isSavedToHistory ? '✅ Saved to History' : '❌ Not Saved to History'}
              </Text>
            </View>
            
            {/* Display the JSON response in a readable format */}
            <View style={styles.jsonContainer}>
              <Text style={styles.jsonTitle}>Raw Response:</Text>
              <Text style={styles.jsonText}>{JSON.stringify(analysisResult, null, 2)}</Text>
            </View>
            
            {/* Try to display structured data if available */}
            {(analysisResult.name || analysisResult.medicine) && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Medicine Name:</Text>
                <Text style={styles.resultValue}>{analysisResult.name || analysisResult.medicine}</Text>
              </View>
            )}
            
            {(analysisResult.times_per_day || analysisResult.dosage) && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Dosage:</Text>
                <Text style={styles.resultValue}>
                  {analysisResult.times_per_day ? `${analysisResult.dosage} times per day` : analysisResult.dosage}
                </Text>
              </View>
            )}
            
            {(analysisResult.information_of_medicine || analysisResult.instructions) && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Instructions:</Text>
                <Text style={styles.resultValue}>
                  {analysisResult.information_of_medicine || analysisResult.instructions}
                </Text>
              </View>
            )}
            
            <View style={styles.resultsButtonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.retakeButton]} 
                onPress={retakePicture}
              >
                <Text style={[styles.buttonText, styles.retakeButtonText]}>Take Another</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.analyzeButton]} 
                onPress={closeResults}
              >
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (capturedImage && !showMedicinePopup) {
    //console.log('Rendering captured image preview with URI:', capturedImage);
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          <Image 
            source={{ uri: capturedImage }} 
            style={styles.previewImage}
            onError={(error) => {
              console.error('Image load error:', error);
              Alert.alert('Image Error', 'Failed to load captured image. Please try again.');
            }}
            onLoad={() => console.log('Image loaded successfully')}
          />
          <View style={styles.previewOverlay}>
            <Text style={styles.previewTitle}>Photo Captured</Text>
            <Text style={styles.previewSubtitle}>Tap Analyze to process your medication</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.retakeButton]} 
                onPress={retakePicture}
                disabled={isAnalyzing}
              >
                <Text style={[styles.buttonText, styles.retakeButtonText]}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]} 
                onPress={analyzePicture}
                disabled={isAnalyzing}
              >
                <Text style={styles.buttonText}>
                  {isAnalyzing ? '🔍 Analyzing...' : 'Analyze'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Medicine Info Popup */}
        <MedicineInfoPopup
          visible={showMedicinePopup}
          onClose={handleCloseMedicinePopup}
          medicineData={medicineData}
          onSave={handleSaveMedicine}
        />
      </View>
    );
  }
  
  // Show popup even when returning to camera view
  if (showMedicinePopup) {
    return (
      <View style={styles.container}>
        <MedicineInfoPopup
          visible={showMedicinePopup}
          onClose={handleCloseMedicinePopup}
          medicineData={medicineData}
          onSave={handleSaveMedicine}
        />
      </View>
    );
  }

  console.log('Rendering camera view. Captured image:', capturedImage, 'Show results:', showResults, 'Analysis result:', analysisResult);
  
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
        zoom={zoom}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <Text style={styles.flipButtonText}>Flip</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.zoomControls}>
            <TouchableOpacity 
              style={styles.zoomButton} 
              onPress={() => adjustZoom('out')}
              disabled={zoom <= 0}
            >
              <Text style={styles.zoomButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
            <TouchableOpacity 
              style={styles.zoomButton} 
              onPress={() => adjustZoom('in')}
              disabled={zoom >= 1}
            >
              <Text style={styles.zoomButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
      
      {/* Medicine Info Popup */}
      <MedicineInfoPopup
        visible={showMedicinePopup}
        onClose={handleCloseMedicinePopup}
        medicineData={medicineData}
        onSave={handleSaveMedicine}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 60,
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  zoomButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  zoomText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 15,
    minWidth: 40,
    textAlign: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 30,
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    paddingBottom: 40,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  previewSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: RED,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  title: {
    color: RED,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    color: 'rgba(0,0,0,0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  helpText: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: RED,
    textAlign: 'center',
    marginBottom: 24,
  },
  resultItem: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  resultsButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
  },
  saveStatusContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  saveStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  savedStatus: {
    color: '#28a745',
  },
  notSavedStatus: {
    color: '#dc3545',
  },
  jsonContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  jsonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  jsonText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
    lineHeight: 16,
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
  },
  // Permission States
  permissionContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionCard: {
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
  iconContainer: {
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
  cameraIcon: {
    fontSize: 44,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionHelpText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});


