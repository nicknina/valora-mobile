import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function ConnectionStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    return () => unsubscribe && typeof unsubscribe === 'function' && unsubscribe();
  }, []);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
      <Text style={styles.label}>{online ? 'Online / sincronizado' : 'Offline / local'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 45,
    right: 18,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  dotOnline: {
    backgroundColor: '#22c55e',
  },
  dotOffline: {
    backgroundColor: '#9ca3af',
  },
  label: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },
});
