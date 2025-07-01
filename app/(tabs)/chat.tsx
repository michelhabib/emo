import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChatBox from '@/components/ChatBox';
import { Platform } from 'react-native';

export default function ChatScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ChatBox socketUrl={Platform.OS === 'android'
            ? 'http://10.0.1.54:8000/'
            : 'http://10.0.1.54:8000/'} />
    </SafeAreaView>
  );
} 