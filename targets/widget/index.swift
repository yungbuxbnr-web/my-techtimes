import WidgetKit
import SwiftUI

// MARK: - Shared UserDefaults (App Group)
private let appGroupID = "group.com.buxrug.techtime"
private var sharedDefaults: UserDefaults? { UserDefaults(suiteName: appGroupID) }

// MARK: - Timeline Entry

struct DayProgressEntry: TimelineEntry {
    let date: Date
    let elapsedSeconds: Double
    let totalSeconds: Double
    // Live data from app
    let jobsToday: Int
    let timeLoggedMinutes: Int
    let workStatus: String // "working" | "break" | "off"
    // Prefs
    let widgetTheme: String  // "dark" | "light" | "auto"
    let showSeconds: Bool
    let workHoursMode: Bool
    let workStartTime: String // HH:MM
    let workEndTime: String   // HH:MM

    var percentage: Double {
        guard totalSeconds > 0 else { return 0 }
        return min(elapsedSeconds / totalSeconds, 1.0)
    }

    var elapsedHours: Int {
        Int(elapsedSeconds) / 3600
    }

    var elapsedMinutes: Int {
        (Int(elapsedSeconds) % 3600) / 60
    }

    var elapsedSecondsComponent: Int {
        Int(elapsedSeconds) % 60
    }
}

// MARK: - Provider

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
        let defaults = sharedDefaults
        let calendar = Calendar.current

        // Read prefs
        let theme = defaults?.string(forKey: "widget_theme") ?? "dark"
        let showSecs = defaults?.bool(forKey: "widget_show_seconds") ?? false
        let workMode = defaults?.bool(forKey: "widget_work_hours_mode") ?? false
        let workStart = defaults?.string(forKey: "widget_work_start") ?? "07:00"
        let workEnd = defaults?.string(forKey: "widget_work_end") ?? "18:00"

        // Read live data
        let jobsToday = defaults?.integer(forKey: "widget_jobs_today") ?? 0
        let timeLogged = defaults?.integer(forKey: "widget_time_logged") ?? 0
        let workStatus = defaults?.string(forKey: "widget_work_status") ?? "off"

        // Calculate elapsed / total
        let elapsed: Double
        let total: Double

        if workMode {
            // Work hours mode: progress within work day
            let toMinutes: (String) -> Int = { t in
                let parts = t.split(separator: ":").compactMap { Int($0) }
                guard parts.count == 2 else { return 0 }
                return parts[0] * 60 + parts[1]
            }
            let startMin = toMinutes(workStart)
            let endMin = toMinutes(workEnd)
            let totalWorkMin = max(endMin - startMin, 1)
            let nowMin = calendar.component(.hour, from: date) * 60 + calendar.component(.minute, from: date)
            let elapsedWorkMin = max(0, min(nowMin - startMin, totalWorkMin))
            elapsed = Double(elapsedWorkMin) * 60
            total = Double(totalWorkMin) * 60
        } else {
            // 24-hour day mode
            let startOfDay = calendar.startOfDay(for: date)
            elapsed = date.timeIntervalSince(startOfDay)
            total = 24 * 3600
        }

        return DayProgressEntry(
            date: date,
            elapsedSeconds: elapsed,
            totalSeconds: total,
            jobsToday: jobsToday,
            timeLoggedMinutes: timeLogged,
            workStatus: workStatus,
            widgetTheme: theme,
            showSeconds: showSecs,
            workHoursMode: workMode,
            workStartTime: workStart,
            workEndTime: workEnd
        )
    }
}

// MARK: - Widget View

struct DayProgressWidgetEntryView: View {
    var entry: DayProgressEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    // Resolve background color based on theme pref
    private var bgColor: Color {
        switch entry.widgetTheme {
        case "light": return Color.white
        case "auto":  return colorScheme == .dark ? Color.black : Color.white
        default:      return Color.black
        }
    }

    private var textColor: Color {
        switch entry.widgetTheme {
        case "light": return Color.black
        case "auto":  return colorScheme == .dark ? Color.white : Color.black
        default:      return Color.white
        }
    }

    // Work status dot color
    private var statusColor: Color {
        switch entry.workStatus {
        case "working": return Color.green
        case "break":   return Color.yellow
        default:        return Color.gray
        }
    }

    private var elapsedLabel: String {
        if entry.showSeconds {
            return "\(entry.elapsedHours)h \(entry.elapsedMinutes)m \(entry.elapsedSecondsComponent)s elapsed"
        }
        return "\(entry.elapsedHours)h \(entry.elapsedMinutes)m elapsed"
    }

    private var jobsLabel: String {
        entry.jobsToday == 1 ? "1 job today" : "\(entry.jobsToday) jobs today"
    }

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            if family == .systemSmall {
                smallBody
            } else {
                mediumBody
            }
        }
        .widgetURL(URL(string: "techtimes://")!)
    }

    // MARK: Small layout
    private var smallBody: some View {
        VStack(spacing: 6) {
            // Time
            Text(entry.date, style: .time)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(textColor)

            // Circular progress
            circularProgress(size: 80, strokeWidth: 7, fontSize: 15, subFontSize: 9)

            // Elapsed
            Text(elapsedLabel)
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundColor(textColor.opacity(0.7))
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Spacer(minLength: 0)

            // Add Job button at bottom
            addJobButton
        }
        .padding(12)
    }

    // MARK: Medium layout
    private var mediumBody: some View {
        HStack(spacing: 16) {
            // Left: time + progress
            VStack(spacing: 6) {
                Text(entry.date, style: .time)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundColor(textColor)

                circularProgress(size: 90, strokeWidth: 8, fontSize: 18, subFontSize: 10)

                Text(elapsedLabel)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(textColor.opacity(0.7))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            // Right: live data + add job
            VStack(alignment: .leading, spacing: 8) {
                // Work status indicator
                HStack(spacing: 6) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)
                    Text(entry.workStatus.capitalized)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(textColor)
                }

                // Jobs today
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(entry.jobsToday)")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(textColor)
                    Text("jobs today")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(textColor.opacity(0.6))
                }

                Spacer(minLength: 0)

                // Add Job button bottom-right
                HStack {
                    Spacer()
                    addJobButton
                }
            }
        }
        .padding(14)
    }

    // MARK: Circular progress ring
    private func circularProgress(size: CGFloat, strokeWidth: CGFloat, fontSize: CGFloat, subFontSize: CGFloat) -> some View {
        let pctText = String(format: "%.1f%%", entry.percentage * 100)
        return ZStack {
            Circle()
                .stroke(textColor.opacity(0.15), lineWidth: strokeWidth)
            Circle()
                .trim(from: 0, to: entry.percentage)
                .stroke(
                    LinearGradient(
                        colors: [Color.blue, Color.cyan],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            VStack(spacing: 1) {
                Text(pctText)
                    .font(.system(size: fontSize, weight: .bold, design: .rounded))
                    .foregroundColor(textColor)
                Text(entry.workHoursMode ? "of shift" : "of day")
                    .font(.system(size: subFontSize, weight: .medium))
                    .foregroundColor(textColor.opacity(0.6))
            }
        }
        .frame(width: size, height: size)
    }

    // MARK: Add Job deep-link button
    private var addJobButton: some View {
        Link(destination: URL(string: "techtimes://add-job")!) {
            HStack(spacing: 4) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 12, weight: .semibold))
                Text("Add Job")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
            }
            .foregroundColor(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                Capsule()
                    .fill(Color.blue.opacity(0.85))
            )
        }
    }
}

// MARK: - Widget Configuration

@main
struct DayProgressWidget: Widget {
    let kind: String = "DayProgressWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DayProgressProvider()) { entry in
            DayProgressWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Day Progress")
        .description("Track your day progress and jobs logged.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
