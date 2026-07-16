import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  message: string;
  history?: ChatMessage[];
  context: {
    todayDate: string;
    todaySoldHours: number;
    todayJobCount: number;
    todayTotalAw: number;
    todayTarget: number;
    todayScheduledHours: number;
    todayEfficiency: number;
    todayShiftProgress: number;
    todayExpectedSoldHours: number;
    todayPaceDifference: number;
    todayForecastSoldHours: number;
    todayAbsenceType?: string;
    todayAbsenceHours?: number;
    weekSoldHours: number;
    weekJobCount: number;
    weekTotalAw: number;
    month: string;
    monthSoldHours: number;
    monthTargetHours: number;
    monthAvailableHours: number;
    monthEfficiency: number;
    monthTotalJobs: number;
    monthTotalAw: number;
    monthRemainingHours: number;
    dailyHours: number;
    workingDays: number[];
    saturdayWorking: boolean;
    remainingWorkingDays: number;
    projectedMonthSoldHours: number;
    requiredDailyAverage: number;
    recentDailyAverages: number[];
    absenceCount: number;
    totalAbsenceHours: number;
  };
}

interface ChatResponse {
  reply: string;
  sources: string[];
}

interface TechTimeAssistantAnalytics {
  // Today
  todaySoldHours?: number;
  todayTargetHours?: number;
  todayAvailableHours?: number;
  todayJobCount?: number;
  todayTotalAw?: number;
  todayEfficiency?: number;
  todayShiftProgress?: number;
  todayExpectedSoldHours?: number;
  todayPaceDifference?: number;
  todayForecast?: number;
  todayAbsenceHours?: number;
  todayAbsenceType?: string;
  // Week
  weekSoldHours?: number;
  weekJobCount?: number;
  weekTotalAw?: number;
  weekAvailableHours?: number;
  weekEfficiency?: number;
  // Month
  monthSoldHours?: number;
  monthTargetHours?: number;
  monthAvailableHours?: number;
  monthEfficiency?: number;
  monthJobCount?: number;
  monthTotalAw?: number;
  monthRemainingHours?: number;
  monthRemainingWorkingDays?: number;
  monthRequiredDailyAverage?: number;
  monthForecast?: number;
  monthForecastConfidence?: string;
  // Schedule
  scheduleDailyHours?: number;
  scheduleWorkingDays?: number[];
  // Recent performance
  recentDailyAverages?: number[];
  recentMedianDaily?: number;
  // Absences
  absenceCount?: number;
  absenceTotalHours?: number;
  // Scenario
  scenarioExtraSoldHours?: number;
  scenarioAbsenceDays?: number;
  scenarioAbsenceType?: string;
}

interface TechTimeAssistantRequest {
  question: string;
  period?: string;
  analytics: TechTimeAssistantAnalytics;
  conversationContext?: string;
}

interface TechTimeAssistantResponse {
  answer: string;
  sources: string[];
  period: string;
  generatedAt: string;
  model: string;
}

export function registerAiRoutes(app: App) {
  const fastify = app.fastify;

  fastify.post<{ Body: ChatRequestBody }>(
    '/ai/chat',
    {
      schema: {
        description: 'Chat with TechTimes AI performance assistant',
        tags: ['ai'],
        body: {
          type: 'object',
          required: ['message', 'context'],
          properties: {
            message: { type: 'string', minLength: 1, maxLength: 500 },
            history: {
              type: 'array',
              maxItems: 10,
              items: {
                type: 'object',
                required: ['role', 'content'],
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant'] },
                  content: { type: 'string' },
                },
              },
            },
            context: {
              type: 'object',
              required: [
                'todayDate',
                'todaySoldHours',
                'todayJobCount',
                'todayTotalAw',
                'todayTarget',
                'todayScheduledHours',
                'todayEfficiency',
                'todayShiftProgress',
                'todayExpectedSoldHours',
                'todayPaceDifference',
                'todayForecastSoldHours',
                'weekSoldHours',
                'weekJobCount',
                'weekTotalAw',
                'month',
                'monthSoldHours',
                'monthTargetHours',
                'monthAvailableHours',
                'monthEfficiency',
                'monthTotalJobs',
                'monthTotalAw',
                'monthRemainingHours',
                'dailyHours',
                'workingDays',
                'saturdayWorking',
                'remainingWorkingDays',
                'projectedMonthSoldHours',
                'requiredDailyAverage',
                'recentDailyAverages',
                'absenceCount',
                'totalAbsenceHours',
              ],
              properties: {
                todayDate: { type: 'string' },
                todaySoldHours: { type: 'number' },
                todayJobCount: { type: 'number' },
                todayTotalAw: { type: 'number' },
                todayTarget: { type: 'number' },
                todayScheduledHours: { type: 'number' },
                todayEfficiency: { type: 'number' },
                todayShiftProgress: { type: 'number' },
                todayExpectedSoldHours: { type: 'number' },
                todayPaceDifference: { type: 'number' },
                todayForecastSoldHours: { type: 'number' },
                todayAbsenceType: { type: 'string' },
                todayAbsenceHours: { type: 'number' },
                weekSoldHours: { type: 'number' },
                weekJobCount: { type: 'number' },
                weekTotalAw: { type: 'number' },
                month: { type: 'string' },
                monthSoldHours: { type: 'number' },
                monthTargetHours: { type: 'number' },
                monthAvailableHours: { type: 'number' },
                monthEfficiency: { type: 'number' },
                monthTotalJobs: { type: 'number' },
                monthTotalAw: { type: 'number' },
                monthRemainingHours: { type: 'number' },
                dailyHours: { type: 'number' },
                workingDays: {
                  type: 'array',
                  items: { type: 'number' },
                },
                saturdayWorking: { type: 'boolean' },
                remainingWorkingDays: { type: 'number' },
                projectedMonthSoldHours: { type: 'number' },
                requiredDailyAverage: { type: 'number' },
                recentDailyAverages: {
                  type: 'array',
                  items: { type: 'number' },
                },
                absenceCount: { type: 'number' },
                totalAbsenceHours: { type: 'number' },
              },
            },
          },
        },
        response: {
          200: {
            description: 'AI response with sources',
            type: 'object',
            properties: {
              reply: { type: 'string' },
              sources: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          400: {
            description: 'Bad request',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ChatRequestBody }>, reply: FastifyReply): Promise<ChatResponse> => {
      app.logger.info({ body: request.body }, 'AI chat request received');

      const { message, history = [], context } = request.body;

      // Validate message
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        app.logger.warn('Invalid message: empty or missing');
        return reply.status(400).send({ error: 'Message is required and must not be empty' });
      }

      if (!context) {
        app.logger.warn('Invalid request: missing context');
        return reply.status(400).send({ error: 'Context is required' });
      }

      // Truncate message to 500 chars
      const truncatedMessage = message.substring(0, 500).trim();

      // Strip PII
      const emailRegex = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi;
      const phoneRegex = /(\+?[\d\s\-().]{7,15})/g;
      const sanitizedMessage = truncatedMessage
        .replace(emailRegex, '[email]')
        .replace(phoneRegex, '[phone]');

      // Limit history to last 10
      const limitedHistory = history.slice(-10);

      // Build performance data message
      const performanceData = `[PERFORMANCE DATA]
Date: ${context.todayDate}
Today: ${context.todaySoldHours}h sold / ${context.todayTarget}h target (${context.todayEfficiency}%)
Shift progress: ${Math.round(context.todayShiftProgress * 100)}% elapsed
Expected by now: ${context.todayExpectedSoldHours}h | Actual: ${context.todaySoldHours}h | Pace: ${context.todayPaceDifference >= 0 ? '+' : ''}${context.todayPaceDifference}h
Today's jobs: ${context.todayJobCount} | AW: ${context.todayTotalAw}
Week: ${context.weekSoldHours}h sold, ${context.weekJobCount} jobs
Month (${context.month}): ${context.monthSoldHours}h / ${context.monthTargetHours}h target (${context.monthEfficiency}%)
Remaining this month: ${context.monthRemainingHours}h needed, ${context.remainingWorkingDays} working days left
Required daily average: ${context.requiredDailyAverage}h/day
Recent daily averages: ${context.recentDailyAverages.join(', ')}h
Absences this month: ${context.absenceCount} (${context.totalAbsenceHours}h)
[END DATA]

Question: ${sanitizedMessage}`;

      const systemPrompt = `You are TechTimes AI, a read-only performance assistant for a vehicle technician.

You have access to the technician's real performance data provided in the context below.

Rules:
- ONLY use numbers from the provided context. Never invent or estimate figures not in the data.
- Be concise, practical and encouraging.
- When data is unavailable, say "I don't have that information" clearly.
- Format hours as "8.5h", percentages as "67%", days as "working days".
- Do not suggest creating, editing or deleting jobs, absences or settings.
- Focus on actionable insights the technician can act on today.
- Keep responses under 200 words unless a detailed breakdown is requested.`;

      // Build messages for AI
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...limitedHistory,
        { role: 'user', content: performanceData },
      ];

      try {
        app.logger.debug({ messageCount: messages.length }, 'Calling AI with messages');

        // Call AI API
        const response = await fetch('https://api.together.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          app.logger.error(
            {
              err: new Error(`AI API returned ${response.status}`),
              status: response.status,
              errorData,
            },
            'AI API error'
          );
          return { reply: 'AI is temporarily unavailable. Your local data is still accurate.', sources: [] };
        }

        const data = (await response.json()) as any;
        const reply = data.choices?.[0]?.message?.content || '';

        if (!reply) {
          app.logger.warn('Empty reply from AI');
          return { reply: 'AI is temporarily unavailable. Your local data is still accurate.', sources: [] };
        }

        // Extract sources based on question keywords
        const lowerMessage = sanitizedMessage.toLowerCase();
        const sourceSet = new Set<string>();

        // Always include today's date
        sourceSet.add('todayDate');

        if (lowerMessage.includes('today') || lowerMessage.includes('shift')) {
          sourceSet.add('todaySoldHours');
          sourceSet.add('todayTarget');
          sourceSet.add('todayEfficiency');
        }
        if (lowerMessage.includes('week')) {
          sourceSet.add('weekSoldHours');
          sourceSet.add('weekJobCount');
        }
        if (lowerMessage.includes('month') || lowerMessage.includes('target')) {
          sourceSet.add('monthSoldHours');
          sourceSet.add('monthTargetHours');
          sourceSet.add('monthEfficiency');
        }
        if (lowerMessage.includes('pace') || lowerMessage.includes('average')) {
          sourceSet.add('requiredDailyAverage');
          sourceSet.add('recentDailyAverages');
        }
        if (lowerMessage.includes('absence')) {
          sourceSet.add('absenceCount');
          sourceSet.add('totalAbsenceHours');
        }

        const sources = Array.from(sourceSet);

        app.logger.info({ reply: reply.substring(0, 100), sources }, 'AI response generated successfully');

        return { reply, sources };
      } catch (error) {
        app.logger.error(
          { err: error, message: sanitizedMessage },
          'Error calling AI API'
        );
        return { reply: 'AI is temporarily unavailable. Your local data is still accurate.', sources: [] };
      }
    }
  );

  // POST /api/techtime-assistant - Tech Times performance assistant
  fastify.post<{ Body: TechTimeAssistantRequest }>(
    '/api/techtime-assistant',
    {
      schema: {
        description: 'Tech Times performance assistant for answering questions about technician analytics',
        tags: ['techtime-assistant'],
        body: {
          type: 'object',
          required: ['question', 'analytics'],
          properties: {
            question: { type: 'string', minLength: 1, maxLength: 500 },
            period: { type: 'string' },
            analytics: {
              type: 'object',
              properties: {
                todaySoldHours: { type: 'number' },
                todayTargetHours: { type: 'number' },
                todayAvailableHours: { type: 'number' },
                todayJobCount: { type: 'number' },
                todayTotalAw: { type: 'number' },
                todayEfficiency: { type: 'number' },
                todayShiftProgress: { type: 'number' },
                todayExpectedSoldHours: { type: 'number' },
                todayPaceDifference: { type: 'number' },
                todayForecast: { type: 'number' },
                todayAbsenceHours: { type: 'number' },
                todayAbsenceType: { type: 'string' },
                weekSoldHours: { type: 'number' },
                weekJobCount: { type: 'number' },
                weekTotalAw: { type: 'number' },
                weekAvailableHours: { type: 'number' },
                weekEfficiency: { type: 'number' },
                monthSoldHours: { type: 'number' },
                monthTargetHours: { type: 'number' },
                monthAvailableHours: { type: 'number' },
                monthEfficiency: { type: 'number' },
                monthJobCount: { type: 'number' },
                monthTotalAw: { type: 'number' },
                monthRemainingHours: { type: 'number' },
                monthRemainingWorkingDays: { type: 'number' },
                monthRequiredDailyAverage: { type: 'number' },
                monthForecast: { type: 'number' },
                monthForecastConfidence: { type: 'string' },
                scheduleDailyHours: { type: 'number' },
                scheduleWorkingDays: { type: 'array', items: { type: 'number' } },
                recentDailyAverages: { type: 'array', items: { type: 'number' } },
                recentMedianDaily: { type: 'number' },
                absenceCount: { type: 'number' },
                absenceTotalHours: { type: 'number' },
                scenarioExtraSoldHours: { type: 'number' },
                scenarioAbsenceDays: { type: 'number' },
                scenarioAbsenceType: { type: 'string' },
              },
            },
            conversationContext: { type: 'string', maxLength: 200 },
          },
        },
        response: {
          200: {
            description: 'Assistant response',
            type: 'object',
            properties: {
              answer: { type: 'string' },
              sources: { type: 'array', items: { type: 'string' } },
              period: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
              model: { type: 'string' },
            },
          },
          400: {
            description: 'Bad request',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: TechTimeAssistantRequest }>,
      reply: FastifyReply
    ): Promise<TechTimeAssistantResponse> => {
      app.logger.info(
        {
          question: request.body.question.substring(0, 50),
          period: request.body.period,
        },
        'Tech Times assistant request received'
      );

      const { question, period, analytics, conversationContext } = request.body;

      // Validate question
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        app.logger.warn('Invalid question: empty or missing');
        return reply.status(400).send({ error: 'Question is required and must not be empty' });
      }

      if (!analytics || typeof analytics !== 'object') {
        app.logger.warn('Invalid analytics: missing or not an object');
        return reply.status(400).send({ error: 'Analytics is required' });
      }

      // Truncate question to 500 chars
      let sanitisedQuestion = question.substring(0, 500).trim();

      // Strip UK vehicle registration plates
      // Modern format: AB12 XYZ or AB12XYZ
      sanitisedQuestion = sanitisedQuestion.replace(/\b[A-Z]{2}[0-9]{2}\s?[A-Z]{3}\b/gi, '[REG]');
      // Old-style format (only standalone tokens)
      sanitisedQuestion = sanitisedQuestion.replace(/\b[A-Z]{1,3}[0-9]{1,4}[A-Z]{0,3}\b/g, (match) => {
        // Only replace if it looks like a registration (not a normal word)
        return /[0-9]/.test(match) ? '[REG]' : match;
      });

      // Build analytics summary
      const analyticsSummary = buildAnalyticsSummary(analytics);

      // Collect sources (keys that were present and non-null)
      const sources = Object.keys(analytics).filter(
        (key) => analytics[key as keyof TechTimeAssistantAnalytics] != null
      );

      // Build user message
      const userMessage = `[Analytics]\n${analyticsSummary}\n\n[Context]\n${conversationContext || 'None'}\n\n[Question]\n${sanitisedQuestion}`;

      const systemPrompt = `You are the Tech Times performance assistant — a helpful, practical AI for automotive technicians tracking their workshop performance.

You have access to the user's real performance analytics. Use ONLY the supplied analytics data to answer questions. Never invent, estimate or assume figures that are not in the supplied data.

When answering:
1. State the current position clearly using the supplied numbers
2. Explain what it means in plain language
3. Give a forecast or projection if relevant data is available
4. State what is required (e.g. daily average needed)
5. Note any important assumptions or limitations

Rules:
- Never invent numbers. If data is missing, say "I don't have that information"
- Keep answers concise and practical (3-6 sentences for simple questions, up to 10 for complex ones)
- Use the technician's actual figures, not generic examples
- Distinguish clearly between recorded facts, calculations, forecasts and assumptions
- If the question is about a scenario ("what if"), clearly label it as hypothetical
- Do not discuss PINs, passwords, personal customer data or vehicle registrations
- Format numbers to 1 decimal place (e.g. 7.5 hours, 94.2%)`;

      try {
        app.logger.debug(
          { analyticsKeyCount: sources.length },
          'Calling Gemini AI with tech times analytics'
        );

        // Call Gemini API
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY!,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `${systemPrompt}\n\n${userMessage}`,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 600,
              temperature: 0.3,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          app.logger.error(
            {
              err: new Error(`Gemini API returned ${response.status}`),
              status: response.status,
              errorData,
            },
            'Gemini API error'
          );
          return {
            answer: "I'm unable to answer right now. Your local projections are still available.",
            sources: [],
            period: period || 'unknown',
            generatedAt: new Date().toISOString(),
            model: 'unavailable',
          };
        }

        const data = (await response.json()) as any;
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!answer) {
          app.logger.warn('Empty answer from Gemini API');
          return {
            answer: "I'm unable to answer right now. Your local projections are still available.",
            sources: [],
            period: period || 'unknown',
            generatedAt: new Date().toISOString(),
            model: 'unavailable',
          };
        }

        app.logger.info(
          {
            answer: answer.substring(0, 100),
            sourceCount: sources.length,
          },
          'Tech Times assistant answer generated successfully'
        );

        return {
          answer,
          sources,
          period: period || 'unknown',
          generatedAt: new Date().toISOString(),
          model: 'gemini-2.0-flash-001',
        };
      } catch (error) {
        app.logger.error(
          { err: error, question: sanitisedQuestion },
          'Error calling Gemini API'
        );
        return {
          answer: "I'm unable to answer right now. Your local projections are still available.",
          sources: [],
          period: period || 'unknown',
          generatedAt: new Date().toISOString(),
          model: 'unavailable',
        };
      }
    }
  );
}

function buildAnalyticsSummary(analytics: TechTimeAssistantAnalytics): string {
  const sections: string[] = [];

  // Today section
  const todayKeys = Object.entries(analytics)
    .filter(([key]) => key.startsWith('today'))
    .filter(([, value]) => value != null);
  if (todayKeys.length > 0) {
    const todayStr = todayKeys.map(([key, value]) => `${key}=${value}`).join(', ');
    sections.push(`TODAY: ${todayStr}`);
  }

  // Week section
  const weekKeys = Object.entries(analytics)
    .filter(([key]) => key.startsWith('week'))
    .filter(([, value]) => value != null);
  if (weekKeys.length > 0) {
    const weekStr = weekKeys.map(([key, value]) => `${key}=${value}`).join(', ');
    sections.push(`WEEK: ${weekStr}`);
  }

  // Month section
  const monthKeys = Object.entries(analytics)
    .filter(([key]) => key.startsWith('month'))
    .filter(([, value]) => value != null);
  if (monthKeys.length > 0) {
    const monthStr = monthKeys.map(([key, value]) => `${key}=${value}`).join(', ');
    sections.push(`MONTH: ${monthStr}`);
  }

  // Schedule section
  const scheduleKeys = Object.entries(analytics)
    .filter(([key]) => key.startsWith('schedule'))
    .filter(([, value]) => value != null);
  if (scheduleKeys.length > 0) {
    const scheduleStr = scheduleKeys.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ');
    sections.push(`SCHEDULE: ${scheduleStr}`);
  }

  // Recent section
  const recentKeys = Object.entries(analytics)
    .filter(([key]) => key.startsWith('recent'))
    .filter(([, value]) => value != null);
  if (recentKeys.length > 0) {
    const recentStr = recentKeys.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ');
    sections.push(`RECENT: ${recentStr}`);
  }

  // Absence section
  const absenceKeys = Object.entries(analytics)
    .filter(([key]) => key.startsWith('absence'))
    .filter(([, value]) => value != null);
  if (absenceKeys.length > 0) {
    const absenceStr = absenceKeys.map(([key, value]) => `${key}=${value}`).join(', ');
    sections.push(`ABSENCES: ${absenceStr}`);
  }

  // Scenario section
  const scenarioKeys = Object.entries(analytics)
    .filter(([key]) => key.startsWith('scenario'))
    .filter(([, value]) => value != null);
  if (scenarioKeys.length > 0) {
    const scenarioStr = scenarioKeys.map(([key, value]) => `${key}=${value}`).join(', ');
    sections.push(`SCENARIO: ${scenarioStr}`);
  }

  return sections.join('\n');
}
