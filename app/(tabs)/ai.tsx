
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Animated,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Clipboard,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useThemeContext } from '@/contexts/ThemeContext';
import { buildFullAnalytics, buildAIPayload, FullAnalytics } from '@/utils/analyticsEngine';
import { router } from 'expo-router';

const BACKEND_URL =
  (Constants.expoConfig?.extra as { backendUrl?: string } | undefined)?.backendUrl ||
  'https://rf3w5rdjxpajrmgag8hsex887xbu4fvt.app.specular.dev';

type Period = 'today' | 'week' | 'month';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  period?: string;
  isError?: boolean;
  showDataUsed?: boolean;
};

const SUGGESTED_QUESTIONS: Record<Period, string[]> = {
  today: [
    'Review my performance today',
    'Am I ahead or behind right now?',
    'What do I need to finish the day on target?',
    'Forecast my sold hours by end of shift',
  ],
  week: [
    'How is my week going?',
    "What's my daily average this week?",
    'Compare today with my recent average',
  ],
  month: [
    'Will I reach my monthly target?',
    'What daily average do I need?',
    'How have absences affected my target?',
    'What was my strongest working day?',
  ],
};

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = makePulse(dot1, 0);
    const a2 = makePulse(dot2, 200);
    const a3 = makePulse(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingRow}>
      {[dot1, dot2, dot3].map((anim, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { backgroundColor: color, opacity: anim }]}
        />
      ))}
    </View>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard({ cardColor, borderColor }: { cardColor: string; borderColor: string }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

  return (
    <View style={[styles.skeletonCard, { backgroundColor: cardColor, borderColor }]}>
      <Animated.View style={[styles.skeletonLine, { opacity, backgroundColor: borderColor, width: '60%' }]} />
      <Animated.View style={[styles.skeletonLine, { opacity, backgroundColor: borderColor, width: '90%', marginTop: 8 }]} />
      <Animated.View style={[styles.skeletonLine, { opacity, backgroundColor: borderColor, width: '75%', marginTop: 8 }]} />
    </View>
  );
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  primaryColor,
  cardColor,
  textColor,
  textSecondary,
  borderColor,
  errorColor,
  onToggleDataUsed,
}: {
  message: Message;
  primaryColor: string;
  cardColor: string;
  textColor: string;
  textSecondary: string;
  borderColor: string;
  errorColor: string;
  onToggleDataUsed: (id: string) => void;
}) {
  const isUser = message.role === 'user';
  const mentionsForecast =
    !isUser &&
    /forecast|projection|target|predict/i.test(message.content);

  const timeStr = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleCopy = () => {
    console.log('[AI] Copy button pressed for message:', message.id);
    Clipboard.setString(message.content);
    Alert.alert('Copied', 'Message copied to clipboard.');
  };

  const handleOpenProjections = () => {
    console.log('[AI] Open Projections button pressed from message:', message.id);
    router.push('/projections');
  };

  if (isUser) {
    return (
      <View style={styles.userBubbleWrapper}>
        <View style={[styles.userBubble, { backgroundColor: primaryColor }]}>
          <Text style={styles.userBubbleText}>{message.content}</Text>
          <Text style={[styles.bubbleTime, { color: 'rgba(255,255,255,0.6)' }]}>{timeStr}</Text>
        </View>
      </View>
    );
  }

  const bubbleBg = message.isError ? `${errorColor}22` : cardColor;
  const bubbleBorder = message.isError ? errorColor : borderColor;

  return (
    <View style={styles.aiBubbleWrapper}>
      <View style={[styles.aiBubble, { backgroundColor: bubbleBg, borderColor: bubbleBorder }]}>
        {/* AI label */}
        <View style={styles.aiLabelRow}>
          <MaterialIcons name="auto-awesome" size={14} color={primaryColor} />
          <Text style={[styles.aiLabel, { color: primaryColor }]}>Newly AI</Text>
        </View>

        <Text style={[styles.aiBubbleText, { color: textColor }]}>{message.content}</Text>

        {/* Action row */}
        <View style={styles.bubbleActions}>
          <Text style={[styles.bubbleTime, { color: textSecondary }]}>{timeStr}</Text>
          <View style={styles.bubbleActionButtons}>
            {mentionsForecast && (
              <TouchableOpacity
                style={[styles.projBtn, { borderColor: primaryColor }]}
                onPress={handleOpenProjections}
                activeOpacity={0.7}
              >
                <MaterialIcons name="trending-up" size={12} color={primaryColor} />
                <Text style={[styles.projBtnText, { color: primaryColor }]}>Open Projections</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleCopy} style={styles.copyBtn} activeOpacity={0.7}>
              <MaterialIcons name="content-copy" size={14} color={textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Data used expandable */}
        {message.sources && message.sources.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              console.log('[AI] Toggle data used for message:', message.id);
              onToggleDataUsed(message.id);
            }}
            style={[styles.dataUsedToggle, { borderTopColor: borderColor }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.dataUsedToggleText, { color: textSecondary }]}>
              {message.showDataUsed ? '▲ Hide data used' : '▼ Data used'}
            </Text>
          </TouchableOpacity>
        )}
        {message.showDataUsed && message.sources && (
          <View style={[styles.dataUsedContent, { borderTopColor: borderColor }]}>
            {message.sources.map((s, i) => (
              <Text key={i} style={[styles.dataUsedItem, { color: textSecondary }]}>
                • {s}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AIAssistantScreen() {
  const { theme } = useThemeContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<FullAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
  const [isOnline, setIsOnline] = useState(true);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [privacyDismissed, setPrivacyDismissed] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Animated orb
  const orbAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(orbAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [orbAnim]);

  const orbScale = orbAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const orbOpacity = orbAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  // Load analytics on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      console.log('[AI] Loading analytics on mount');
      try {
        setAnalyticsLoading(true);
        const data = await buildFullAnalytics();
        if (!cancelled) {
          setAnalytics(data);
          console.log('[AI] Analytics loaded successfully');
        }
      } catch (e) {
        console.error('[AI] Analytics load failed', e);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDataUsed = useCallback((id: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === id ? { ...m, showDataUsed: !m.showDataUsed } : m))
    );
  }, []);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || isLoading) return;

      console.log('[AI] sendMessage called:', question, 'period:', selectedPeriod);

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: question,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);
      setInputText('');
      setIsLoading(true);

      const controller = new AbortController();
      setAbortController(controller);

      try {
        if (!analytics) throw new Error('Analytics not loaded');

        const lastAssistant = [...messages, userMsg]
          .reverse()
          .find(m => m.role === 'assistant');
        const conversationContext = lastAssistant
          ? lastAssistant.content.slice(0, 200)
          : undefined;

        const payload = buildAIPayload(analytics, question, selectedPeriod, conversationContext);

        console.log('[AI] Sending request to backend:', `${BACKEND_URL}/api/techtime-assistant`);

        const response = await fetch(`${BACKEND_URL}/api/techtime-assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        console.log('[AI] Response status:', response.status);

        if (!response.ok) {
          const errText = await response.text();
          console.error('[AI] Backend error:', response.status, errText);
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[AI] Response received, answer length:', data.answer?.length ?? 0);

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer,
          timestamp: new Date(),
          sources: data.sources,
          period: data.period,
          showDataUsed: false,
        };
        setMessages(prev => [...prev, aiMsg]);
        setIsOnline(true);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.name === 'AbortError') {
          console.log('[AI] Request aborted by user');
          return;
        }
        console.error('[AI] sendMessage error:', error.message);
        setIsOnline(false);
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: isOnline
            ? 'I had trouble connecting. Your local projections are still available — tap "Open Projections" to see them.'
            : 'AI explanations require an internet connection. Your local projections are still available.',
          timestamp: new Date(),
          isError: true,
        };
        setMessages(prev => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
        setAbortController(null);
      }
    },
    [analytics, isLoading, isOnline, messages, selectedPeriod]
  );

  const handleStop = () => {
    console.log('[AI] Stop button pressed');
    if (abortController) {
      abortController.abort();
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleClear = () => {
    console.log('[AI] Clear conversation pressed');
    Alert.alert('Clear Conversation', 'Remove all messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setMessages([]);
          console.log('[AI] Conversation cleared');
        },
      },
    ]);
  };

  const handlePeriodChange = (period: Period) => {
    console.log('[AI] Period changed to:', period);
    setSelectedPeriod(period);
  };

  const handleSuggestedQuestion = (q: string) => {
    console.log('[AI] Suggested question tapped:', q);
    sendMessage(q);
  };

  const handleSend = () => {
    console.log('[AI] Send button pressed, text:', inputText);
    sendMessage(inputText);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isLoading]);

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];

  const suggestedQuestions = SUGGESTED_QUESTIONS[selectedPeriod];

  // Build flat list data
  type ListItem =
    | { type: 'skeleton' }
    | { type: 'privacy' }
    | { type: 'suggestions' }
    | { type: 'message'; message: Message }
    | { type: 'typing' };

  const listData: ListItem[] = [];
  if (analyticsLoading) listData.push({ type: 'skeleton' });
  if (!privacyDismissed) listData.push({ type: 'privacy' });
  if (messages.length === 0 && !analyticsLoading) listData.push({ type: 'suggestions' });
  messages.forEach(m => listData.push({ type: 'message', message: m }));
  if (isLoading) listData.push({ type: 'typing' });

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'skeleton') {
      return (
        <SkeletonCard cardColor={theme.card} borderColor={theme.border} />
      );
    }
    if (item.type === 'privacy') {
      return (
        <View style={[styles.privacyCard, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}44` }]}>
          <View style={styles.privacyRow}>
            <MaterialIcons name="lock" size={16} color={theme.primary} />
            <Text style={[styles.privacyTitle, { color: theme.primary }]}>Privacy Notice</Text>
          </View>
          <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
            Your performance data is sent to the AI assistant to generate personalised insights. No personal identifiers are included. Data is not stored by the AI service.
          </Text>
          <TouchableOpacity
            onPress={() => {
              console.log('[AI] Privacy notice dismissed');
              setPrivacyDismissed(true);
            }}
            style={[styles.privacyDismiss, { borderColor: theme.primary }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.privacyDismissText, { color: theme.primary }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (item.type === 'suggestions') {
      return (
        <View style={styles.suggestionsWrapper}>
          <Text style={[styles.suggestionsTitle, { color: theme.textSecondary }]}>
            Suggested questions
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {suggestedQuestions.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionChip, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleSuggestedQuestion(q)}
                activeOpacity={0.7}
              >
                <Text style={[styles.suggestionChipText, { color: theme.text }]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
    if (item.type === 'message') {
      return (
        <ChatBubble
          message={item.message}
          primaryColor={theme.primary}
          cardColor={theme.card}
          textColor={theme.text}
          textSecondary={theme.textSecondary}
          borderColor={theme.border}
          errorColor={theme.error}
          onToggleDataUsed={toggleDataUsed}
        />
      );
    }
    if (item.type === 'typing') {
      return (
        <View style={styles.aiBubbleWrapper}>
          <View style={[styles.aiBubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TypingIndicator color={theme.primary} />
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerGradient}>
          {/* Animated orb */}
          <Animated.View
            style={[
              styles.orb,
              { transform: [{ scale: orbScale }], opacity: orbOpacity },
            ]}
          >
            <MaterialIcons name="auto-awesome" size={28} color="#fff" />
          </Animated.View>

          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerSubtitle}>Powered by Newly AI</Text>
          </View>

          <View style={styles.headerRight}>
            {/* Online indicator */}
            <View style={styles.onlineIndicator}>
              <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.onlineText, { color: isOnline ? '#10b981' : '#ef4444' }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            {messages.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn} activeOpacity={0.7}>
                <MaterialIcons name="delete-outline" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Period selector */}
        <View style={[styles.periodRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          {periods.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.periodChip,
                selectedPeriod === p.key && { backgroundColor: theme.primary },
              ]}
              onPress={() => handlePeriodChange(p.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.periodChipText,
                  { color: selectedPeriod === p.key ? '#fff' : theme.textSecondary },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={listData}
          keyExtractor={(item, index) => {
            if (item.type === 'message') return item.message.id;
            return `${item.type}-${index}`;
          }}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder="Ask about your performance..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isLoading}
          />
          {isLoading ? (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: theme.error }]}
              onPress={handleStop}
              activeOpacity={0.7}
            >
              <MaterialIcons name="stop" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: inputText.trim() && analytics ? theme.primary : theme.border },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || !analytics}
              activeOpacity={0.7}
            >
              <MaterialIcons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  // Header
  header: { zIndex: 10 },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0f3460',
  },
  orb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextBlock: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 11, fontWeight: '600' },
  clearBtn: { padding: 4 },
  // Period selector
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  periodChipText: { fontSize: 13, fontWeight: '600' },
  // List
  listContent: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 8 },
  // Skeleton
  skeletonCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  skeletonLine: { height: 12, borderRadius: 6 },
  // Privacy
  privacyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  privacyTitle: { fontSize: 13, fontWeight: '700' },
  privacyText: { fontSize: 12, lineHeight: 18 },
  privacyDismiss: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  privacyDismissText: { fontSize: 12, fontWeight: '600' },
  // Suggestions
  suggestionsWrapper: { marginBottom: 16 },
  suggestionsTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, paddingHorizontal: 4 },
  suggestionsScroll: { gap: 8, paddingRight: 8 },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 220,
  },
  suggestionChipText: { fontSize: 13 },
  // User bubble
  userBubbleWrapper: { alignItems: 'flex-end', marginBottom: 10 },
  userBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubbleText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  // AI bubble
  aiBubbleWrapper: { alignItems: 'flex-start', marginBottom: 10 },
  aiBubble: {
    maxWidth: '90%',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  aiLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  aiBubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTime: { fontSize: 11, marginTop: 6 },
  bubbleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  bubbleActionButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  projBtnText: { fontSize: 11, fontWeight: '600' },
  copyBtn: { padding: 4 },
  // Data used
  dataUsedToggle: { marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  dataUsedToggleText: { fontSize: 11 },
  dataUsedContent: { marginTop: 6, paddingTop: 6, borderTopWidth: 1 },
  dataUsedItem: { fontSize: 11, lineHeight: 18 },
  // Typing
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  typingDot: { width: 8, height: 8, borderRadius: 4 },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
