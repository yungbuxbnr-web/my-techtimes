import WidgetKit
import SwiftUI

struct DayProgressEntry: TimelineEntry {
    let date: Date
    let elapsedSeconds: Double
    let totalSeconds: Double

    var percentage: Double {
        elapsedSeconds / totalSeconds
    }

    var elapsedHours: Int {
        Int(elapsedSeconds) / 3600
    }

    var elapsedMinutes: Int {
        (Int(elapsedSeconds) % 3600) / 60
    }
}

struct DayProgressProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayProgressEntry {
        makeEntry(for: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (DayProgressEntry) -> Void) {
        completion(makeEntry(for: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DayProgressEntry>) -> Void) {
        var entries: [DayProgressEntry] = []
        let now = Date()
        // Generate entries every 15 minutes for the next 4 hours
        for i in 0..<16 {
            let entryDate = Calendar.current.date(byAdding: .minute, value: i * 15, to: now)!
            entries.append(makeEntry(for: entryDate))
        }
        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }

    private func makeEntry(for date: Date) -> DayProgressEntry {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let elapsed = date.timeIntervalSince(startOfDay)
        let total: Double = 24 * 3600
        return DayProgressEntry(date: date, elapsedSeconds: elapsed, totalSeconds: total)
    }
}

struct DayProgressWidgetEntryView: View {
    var entry: DayProgressEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 8) {
                // Current time
                Text(entry.date, style: .time)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundColor(.white)

                // Circular progress
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.2), lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: entry.percentage)
                        .stroke(
                            LinearGradient(
                                colors: [Color.blue, Color.cyan],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 2) {
                        Text(String(format: "%.1f%%", entry.percentage * 100))
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text("of day")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(.white.opacity(0.6))
                    }
                }
                .frame(width: 90, height: 90)

                // Elapsed time
                Text("\(entry.elapsedHours)h \(entry.elapsedMinutes)m elapsed")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding()
        }
    }
}

@main
struct DayProgressWidget: Widget {
    let kind: String = "DayProgressWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DayProgressProvider()) { entry in
            DayProgressWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Day Progress")
        .description("See how much of your day has passed.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
