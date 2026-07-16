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
}
