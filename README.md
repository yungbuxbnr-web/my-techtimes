# Tech Times

## 🚀 Project Overview

**my-techtimes** is a robust, fully offline mobile application designed to help users track job statistics and manage their work schedules directly from their device. Built using React Native (Expo) and JavaScript/TypeScript, the application focuses on providing a seamless, reliable experience without requiring an internet connection. It features comprehensive local data storage and integrates user-friendly Android home screen widgets for quick access to key information.

This repository was initially created by Natively GitHub App and further developed to ensure a complete offline-first architecture for managing personal work data.

## 🖥️ Live Demo
This app was built using [Newly.app](https://newly.app) - a platform for creating mobile apps.

## ✨ Key Features & Benefits

*   **100% Offline Functionality**: Every component of the app works flawlessly without an internet connection. All data operations are handled using on-device local storage.
*   **Comprehensive Job Tracking**: Monitor and manage your daily job statistics, including total actual work (AW), job counts, and hours worked.
*   **Android Home Screen Widgets**:
    *   **Small Widget (2x2)**: Displays current day's total AW, job count, hours, and a quick "+ Add Job" button.
    *   **Medium Widget (4x2)**: Includes all small widget features plus backup status (days since last backup) and additional details.
*   **Local Data Storage**: All critical user data, including job records, work schedules, profile information, absences, and settings, is securely stored on the device using AsyncStorage.
*   **Scheduled Management**: Keep track of your work schedule and manage upcoming events or shifts.
*   **User-Friendly Interface**: Designed for ease of use, providing quick access to essential information and actions.
*   **Detailed Offline Verification**: The app has undergone thorough verification to confirm its complete independence from network connectivity (see [OFFLINE_VERIFICATION.md](OFFLINE_VERIFICATION.md) and [APP_STATUS_REPORT.md](APP_STATUS_REPORT.md)).

## 🛠️ Technologies Used

The project is built with modern web technologies focused on mobile application development.

### Languages
*   JavaScript
*   TypeScript

### Tools & Frameworks
*   Node.js
*   Expo (for React Native development)
*   ESLint (for code quality and consistency)

## ⚡ Prerequisites

Before you begin, ensure you have the following installed on your development machine:

*   **Node.js**: [LTS version recommended](https://nodejs.org/en/download/)
*   **npm** or **Yarn**: Package managers for Node.js (usually come with Node.js)
*   **Expo CLI**: [Install globally](https://docs.expo.dev/get-started/installation/) `npm install -g expo-cli`

## 💻 Installation & Setup

Follow these steps to get the project up and running on your local machine:

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Rohan-Shridhar/my-techtimes.git
    cd my-techtimes
    ```

2.  **Install Dependencies**:
    Using npm:
    ```bash
    npm install
    ```
    Or using Yarn:
    ```bash
    yarn install
    ```

3.  **Start the Expo Development Server**:
    ```bash
    npx expo start
    ```
    This will open the Expo Dev Tools in your browser. You can then:
    *   Scan the QR code with your mobile device using the Expo Go app.
    *   Run on an Android emulator or device by pressing `a`.
    *   Run on an iOS simulator or device by pressing `i` (macOS only).

When you open a pull request, fill in the sections as described in [PULL_REQUEST_TEMPLATE](PR_TEMPLATE.md).


## 🚀 Usage

Once the app is installed on your device or simulator, you can start tracking your job statistics, managing your schedule, and accessing data offline.

### Android Home Screen Widget
To utilize the powerful Android home screen widgets:

1.  Ensure the **my-techtimes** app is installed on your Android device.
2.  Follow the detailed setup instructions in the [WIDGET_SETUP_GUIDE.md](WIDGET_SETUP_GUIDE.md) and [ANDROID_WIDGET_IMPLEMENTATION.md](ANDROID_WIDGET_IMPLEMENTATION.md) files.
3.  Add the desired widget size (2x2 or 4x2) to your home screen.

Refer to the following documents for more details on widget functionality and troubleshooting:
*   [WIDGET_QUICK_START.md](WIDGET_QUICK_START.md)
*   [WIDGET_INTEGRATION_CHECKLIST.md](WIDGET_INTEGRATION_CHECKLIST.md)
*   [WIDGET_SUMMARY.md](WIDGET_SUMMARY.md)
*   [WIDGET_TROUBLESHOOTING.md](WIDGET_TROUBLESHOOTING.md)

## ⚙️ Configuration

### Linting Configuration
The project uses ESLint to maintain code quality and consistency. The configuration is defined in `.eslintrc.js`. You can customize linting rules as needed.

### App Configuration
General application configuration can be found in `app.json`. This file typically handles app name, icon, splash screen, and other Expo-specific settings.

### In-App Settings
The application includes various user-configurable settings and notification preferences that are stored locally, as detailed in [OFFLINE_VERIFICATION.md](OFFLINE_VERIFICATION.md). These settings can typically be adjusted within the app's interface.

## 🤝 Contributing

Contributions are welcome! If you'd like to improve this project, please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Ensure your code adheres to the project's linting standards (run `npm run lint` or `yarn lint` if available).
5.  Commit your changes (`git commit -m 'feat: Add new feature'`).
6.  Push to your branch (`git push origin feature/your-feature-name`).
7.  Open a Pull Request to the `main` branch of this repository.

## 📜 License

This project is currently **not licensed**. Please contact the repository owner for licensing information regarding the use, distribution, or modification of this software.

## 🙏 Acknowledgments

*   This app was initially built using [Newly.app](https://newly.app), a platform for creating mobile applications.
*   Special thanks to the open-source community for providing the tools and libraries that made this project possible.

Made with 💙 for creativity.
