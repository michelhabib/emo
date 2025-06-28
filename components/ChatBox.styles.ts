import { Platform, StyleSheet } from 'react-native';

// Shared styles for the ChatBox component
const styles = StyleSheet.create({
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginRight: 8,
  },
  bubble: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  bubbleLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRight: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  bubbleContent: {
    maxWidth: '80%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleContentMe: {
    backgroundColor: '#007aff', // iOS blue tint for outgoing messages
  },
  bubbleContentOther: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  bubbleText: {
    color: '#fff',
  },
  sentPhoto: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
});

export default styles; 