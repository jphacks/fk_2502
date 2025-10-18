import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const PRIMARY_RED = 'rgb(186, 73, 73)';
const LIGHT_BACKGROUND = '#f8f9fa';
const TEXT_DARK = '#333333';
const TEXT_MEDIUM = '#6c757d';
const WHITE = '#ffffff';

export default function MedicineInfoPopup({ visible, onClose, medicineData }) {
  const [editedData, setEditedData] = useState(medicineData);
  // const [selectedDays, setSelectedDays] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [times, setTimes] = useState([new Date(), new Date(), new Date()]);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const [tempTime, setTempTime] = useState(new Date());
  const [endDate, setEndDate] = useState('');

  // const days = ['MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT', 'SUN'];

  useEffect(() => {
    if (medicineData) {
      setEditedData(medicineData);
      // Initialize times based on frequency
      const frequency = medicineData.frequency_per_day || 1;
      
      // Create default times (8 AM, 2 PM, 8 PM)
      const defaultTimes = [
        new Date(new Date().setHours(8, 0, 0, 0)),
        new Date(new Date().setHours(14, 0, 0, 0)),
        new Date(new Date().setHours(20, 0, 0, 0))
      ];
      setTimes(defaultTimes.slice(0, frequency));
      
      // Set default start date to today
      const today = new Date();
      const formattedDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
      setStartDate(formattedDate);
      
      // Calculate end date based on duration
      calculateEndDate(formattedDate, medicineData.duration);
    } else {
      // Initialize with empty data if no medicineData provided
      setEditedData({
        medication_name: '',
        dosage: '',
        instructions: '',
        frequency_per_day: 1,
        duration: ''
      });
      setTimes([new Date(new Date().setHours(8, 0, 0, 0))]);
      const today = new Date();
      const formattedDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
      setStartDate(formattedDate);
    }
  }, [medicineData]);

  const calculateEndDate = (start, duration) => {
    if (!start || !duration) return;
    
    const startDate = new Date(start.split('/').reverse().join('-'));
    let endDate = new Date(startDate);
    
    if (duration.includes('month')) {
      const months = parseInt(duration.split(' ')[0]);
      endDate.setMonth(endDate.getMonth() + months);
    } else if (duration.includes('week')) {
      const weeks = parseInt(duration.split(' ')[0]);
      endDate.setDate(endDate.getDate() + (weeks * 7));
    } else if (duration.includes('day')) {
      const days = parseInt(duration.split(' ')[0]);
      endDate.setDate(endDate.getDate() + days);
    }
    
    const formattedEndDate = `${String(endDate.getMonth() + 1).padStart(2, '0')}/${String(endDate.getDate()).padStart(2, '0')}/${endDate.getFullYear()}`;
    setEndDate(formattedEndDate);
  };

  // const toggleDay = (day) => {
  //   setSelectedDays(prev => 
  //     prev.includes(day) 
  //       ? prev.filter(d => d !== day)
  //       : [...prev, day]
  //   );
  // };

  // const selectAllDays = () => {
  //   setSelectedDays(days);
  // };

  const handleSave = () => {
    if (!startDate) {
      Alert.alert('Error', 'Please select a start date');
      return;
    }
    
    if (times.length === 0) {
      Alert.alert('Error', 'Please set at least one time');
      return;
    }

    Alert.alert(
      'Success!',
      'Medicine schedule has been saved successfully!',
      [
        {
          text: 'OK',
          onPress: onClose
        }
      ]
    );
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const openTimePicker = (index) => {
    setSelectedTimeIndex(index);
    setTempTime(times[index]);
    setShowTimePickerModal(true);
  };

  const onTimeChange = (event, selectedTime) => {
    if (selectedTime) {
      setTempTime(selectedTime);
    }
  };

  const confirmTimeChange = () => {
    const newTimes = [...times];
    newTimes[selectedTimeIndex] = tempTime;
    setTimes(newTimes);
    setShowTimePickerModal(false);
  };

  const updateField = (field, value) => {
    setEditedData(prev => ({
      ...(prev || {}),
      [field]: value
    }));
  };

  console.log('🔔 MEDICINE POPUP RENDERING - visible:', visible, 'medicineData:', medicineData ? 'EXISTS' : 'NULL');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.popup}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>MEDICINE INFO</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Medicine Info Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Medicine Details</Text>
              
              <View style={styles.field}>
                <Text style={styles.label}>Medication name:</Text>
                <TextInput
                  style={styles.input}
                  value={editedData?.medication_name || ''}
                  onChangeText={(value) => updateField('medication_name', value)}
                  placeholder="Enter medication name"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Dosage:</Text>
                <TextInput
                  style={styles.input}
                  value={editedData?.dosage || ''}
                  onChangeText={(value) => updateField('dosage', value)}
                  placeholder="e.g., 1 pill 100mg"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Instructions:</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editedData?.instructions || ''}
                  onChangeText={(value) => updateField('instructions', value)}
                  placeholder="e.g., take after eating food"
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Frequency per day:</Text>
                <TextInput
                  style={styles.input}
                  value={editedData?.frequency_per_day?.toString() || ''}
                  onChangeText={(value) => updateField('frequency_per_day', parseInt(value) || 0)}
                  placeholder="2"
                  keyboardType="numeric"
                />
              </View>

              {/* <View style={styles.halfField}>
                <Text style={styles.label}>Frequency per week:</Text>
                <TextInput
                  style={styles.input}
                  value={editedData?.frequency_per_week?.toString() || ''}
                  onChangeText={(value) => updateField('frequency_per_week', parseInt(value) || 0)}
                  placeholder="7"
                  keyboardType="numeric"
                />
              </View> */}

              <View style={styles.field}>
                <Text style={styles.label}>Duration:</Text>
                <TextInput
                  style={styles.input}
                  value={editedData?.duration || ''}
                  onChangeText={(value) => {
                    updateField('duration', value);
                    calculateEndDate(startDate, value);
                  }}
                  placeholder="e.g., 1 month"
                />
              </View>
            </View>

            {/* Time Selection Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TIME SELECTION</Text>
              
              {/* <View style={styles.field}>
                <Text style={styles.label}>Days:</Text>
                <View style={styles.daysContainer}>
                  {days.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayButton,
                        selectedDays.includes(day) && styles.dayButtonSelected
                      ]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[
                        styles.dayText,
                        selectedDays.includes(day) && styles.dayTextSelected
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={selectAllDays} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>Select All Days</Text>
                </TouchableOpacity>
              </View> */}

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Start date:</Text>
                  <TextInput
                    style={styles.input}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="MM/DD/YYYY"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.label}>End date:</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={endDate}
                    editable={false}
                    placeholder="Auto-calculated"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Daily Reminders:</Text>
                <Text style={styles.helpText}>Tap to change the time</Text>
                <View style={styles.timesContainer}>
                  {times.map((time, index) => (
                    <TouchableOpacity 
                      key={index}
                      style={styles.timePickerButton}
                      onPress={() => openTimePicker(index)}
                    >
                      <Text style={styles.timePickerLabel}>
                        {index === 0 ? '1st dose' : index === 1 ? '2nd dose' : '3rd dose'}
                      </Text>
                      <Text style={styles.timePickerValue}>{formatTime(time)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Schedule</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
      
      {/* Time Picker Modal */}
      <Modal
        visible={showTimePickerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <View style={styles.timePickerModalOverlay}>
          <View style={styles.timePickerModalContent}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>
                Select Time for {selectedTimeIndex === 0 ? '1st' : selectedTimeIndex === 1 ? '2nd' : '3rd'} Dose
              </Text>
            </View>
            
            <DateTimePicker
              value={tempTime}
              mode="time"
              is24Hour={false}
              display="spinner"
              onChange={onTimeChange}
              textColor={TEXT_DARK}
            />
            
            <View style={styles.timePickerButtons}>
              <TouchableOpacity 
                style={styles.timePickerCancelButton} 
                onPress={() => setShowTimePickerModal(false)}
              >
                <Text style={styles.timePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.timePickerConfirmButton} 
                onPress={confirmTimeChange}
              >
                <Text style={styles.timePickerConfirmText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popup: {
    backgroundColor: WHITE,
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: PRIMARY_RED,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    color: TEXT_MEDIUM,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginBottom: 15,
  },
  field: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: WHITE,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#f8f9fa',
    color: TEXT_MEDIUM,
  },
  row: {
    flexDirection: 'row',
    gap: 15,
  },
  halfField: {
    flex: 1,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: WHITE,
  },
  dayButtonSelected: {
    backgroundColor: PRIMARY_RED,
    borderColor: PRIMARY_RED,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MEDIUM,
  },
  dayTextSelected: {
    color: WHITE,
  },
  selectAllButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  selectAllText: {
    fontSize: 12,
    color: PRIMARY_RED,
    fontWeight: '600',
  },
  timesContainer: {
    gap: 15,
  },
  timePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 16,
    backgroundColor: WHITE,
  },
  timePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  timePickerValue: {
    fontSize: 18,
    fontWeight: '500',
    color: PRIMARY_RED,
  },
  timePicker: {
    marginTop: 10,
  },
  doneButton: {
    backgroundColor: PRIMARY_RED,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  doneButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  timeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
    minWidth: 40,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: WHITE,
  },
  helpText: {
    fontSize: 12,
    color: TEXT_MEDIUM,
    fontStyle: 'italic',
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 15,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TEXT_MEDIUM,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MEDIUM,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: PRIMARY_RED,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
  },
  timePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timePickerModalContent: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  timePickerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  timePickerButtons: {
    flexDirection: 'row',
    gap: 15,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  timePickerCancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TEXT_MEDIUM,
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MEDIUM,
  },
  timePickerConfirmButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: PRIMARY_RED,
    alignItems: 'center',
  },
  timePickerConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
  },
});
