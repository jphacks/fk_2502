import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';

const RED = 'rgb(186, 73, 73)';

export default function Dashboard() {
  return (
    <ImageBackground
      source={require('../../assets/images/splash-icon.png')}
      resizeMode="cover"
      blurRadius={30}
      style={styles.container}
      imageStyle={styles.bgImage}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome to PillPal</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgImage: {
    opacity: 0.25,
  },
  card: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
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
  },
  subtitle: {
    color: RED,
    marginTop: 8,
  },
});


