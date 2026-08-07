import { scheduleNotification } from './notifications';

/**
 * NEET Master AI - Centralized Real-Data Study Notification Engine
 * Calculates real-time dynamic countdowns, exam dates, streak counts, and target goals.
 */

/**
 * Dynamically calculates exact days remaining until the next upcoming NEET UG Exam.
 * Standard NEET UG Exam is held on the first Sunday of May.
 */
export const getRealNeetDaysRemaining = (targetYear?: number): number => {
  const now = new Date();
  
  let year = targetYear;
  if (!year) {
    try {
      const savedYear = localStorage.getItem('neet_target_year');
      if (savedYear) year = parseInt(savedYear, 10);
    } catch {}
  }
  
  if (!year || isNaN(year)) {
    const currentYear = now.getFullYear();
    const currentMayExam = new Date(currentYear, 4, 10);
    year = now.getTime() > currentMayExam.getTime() ? currentYear + 1 : currentYear;
  }
  
  // First Sunday of May for target year
  const mayFirst = new Date(year, 4, 1);
  const dayOfWeek = mayFirst.getDay(); // 0 is Sunday
  const firstSundayDate = dayOfWeek === 0 ? 1 : 1 + (7 - dayOfWeek);
  
  const examDate = new Date(year, 4, firstSundayDate, 14, 0, 0); // 2:00 PM IST on exam day
  const diffTime = examDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
};

// 1. Test Result & Analysis Alert (Scheduled for 2 MINUTES (120,000ms) after test submit -> Target: 'tests')
export const scheduleDelayedTestResultNotification = async (
  testName: string,
  obtainedMarks: number,
  totalPossibleMarks: number,
  accuracy: number
): Promise<boolean> => {
  const delayMs = 2 * 60 * 1000; // Exactly 2 Minutes
  const scheduleAt = new Date(Date.now() + delayMs);
  const notificationId = Math.abs(Math.floor(Math.random() * 1000000));

  const title = `📊 Test Analysis Ready! (${obtainedMarks}/${totalPossibleMarks})`;
  const body = `Aapka ${testName} result ready ho gaya hai! Real Accuracy: ${Math.round(accuracy)}%. Weak topics aur detailed solution dekhne ke liye tap karein 🎯`;

  console.log(`[NotificationEngine] Scheduling test analysis notification for test "${testName}"...`);
  return await scheduleNotification(title, body, notificationId, scheduleAt, 'tests');
};

// 2. Daily Study Streak & Goal Warning (7:00 PM Reminder -> Target: 'customPractice')
export const checkAndScheduleStreakWarning = async (questionsSolvedToday: number = 0): Promise<boolean> => {
  if (questionsSolvedToday >= 15) return false;

  const remainingNeeded = Math.max(1, 15 - questionsSolvedToday);
  const now = new Date();
  const scheduleAt = new Date();
  scheduleAt.setHours(19, 0, 0, 0); // 7:00 PM today

  if (now.getTime() >= scheduleAt.getTime()) {
    return false;
  }

  const notificationId = 70019;
  const title = "🔥 NEET Streak Alert!";
  const body = `Aaj aapne ${questionsSolvedToday}/15 questions solve kiye hain. Streak save karne ke liye ${remainingNeeded} questions bache hain! Tap to complete 🎯`;

  return await scheduleNotification(title, body, notificationId, scheduleAt, 'customPractice');
};

// 3. Weak Topic Spaced Repetition Reminder (3 days after test -> Target: 'analytics')
export const scheduleWeakTopicRevision = async (topicName: string): Promise<boolean> => {
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const scheduleAt = new Date(Date.now() + threeDaysMs);
  const notificationId = Math.abs(topicName.split('').reduce((acc, c) => c.charCodeAt(0) + (acc << 5) - acc, 0)) % 100000;

  const title = `🧬 Weak Topic Revision: ${topicName}`;
  const body = `Past test analysis ke mutabiq ${topicName} topic ko revise karne ka time ho gaya hai. Tap to solve 5 Quick Questions! 🚀`;

  return await scheduleNotification(title, body, notificationId, scheduleAt, 'analytics');
};

// 4. Battle Room Challenge Instant Push Alert (Target: 'neetCommunity')
export const sendBattleRoomChallengeNotification = async (
  challengerName: string,
  subject: string
): Promise<boolean> => {
  const notificationId = Math.floor(Math.random() * 900000) + 100000;
  const title = `⚔️ Live 1-on-1 Battle Challenge!`;
  const body = `${challengerName} ne aapko ${subject} quiz battle ke liye invite kiya hai! Tap to accept & fight for #1 Rank! 🏆`;

  return await scheduleNotification(title, body, notificationId, undefined, 'neetCommunity');
};

// 5. Daily NEET Countdown Morning Alert (8:00 AM Daily -> Target: 'aiStudyPlan')
export const scheduleDailyNeetCountdown = async (daysRemaining?: number): Promise<boolean> => {
  const realDays = typeof daysRemaining === 'number' && daysRemaining > 0 
    ? daysRemaining 
    : getRealNeetDaysRemaining();

  const now = new Date();
  const scheduleAt = new Date();
  scheduleAt.setHours(8, 0, 0, 0);

  if (now.getTime() >= scheduleAt.getTime()) {
    scheduleAt.setDate(scheduleAt.getDate() + 1);
  }

  const notificationId = 80088;
  const title = `⏳ NEET Exam Target Alert!`;
  const body = `NEET UG Exam me sirf ${realDays} Days bache hain! Real-time daily goals complete karke score boost karein. Let's make today count! 🩺✨`;

  return await scheduleNotification(title, body, notificationId, scheduleAt, 'aiStudyPlan');
};

// 6. Inactivity Re-engagement Alert (48 Hours -> Target: 'tests')
export const scheduleInactivityWarning = async (): Promise<boolean> => {
  const delayMs = 48 * 60 * 60 * 1000;
  const scheduleAt = new Date(Date.now() + delayMs);
  const notificationId = 48048;

  const title = `🚀 Consistency Break Warning!`;
  const body = `Humne aapko 48 hours se study room me nahi dekha! AIIMS Delhi ke liye consistency sabse zaroori hai. Tap to solve 5 Quick Questions! 📈`;

  return await scheduleNotification(title, body, notificationId, scheduleAt, 'tests');
};

// 7. Focus Session Complete Alert (Pomodoro -> Target: 'focusSanctuary')
export const scheduleFocusSessionCompleteNotification = async (durationMins: number, subject: string): Promise<boolean> => {
  const notificationId = Math.floor(Math.random() * 900000) + 200000;
  const title = `🌱 Focus Session Complete!`;
  const body = `Great job! ${durationMins} mins of dedicated ${subject} study completed. Tap to view your focus efficiency score ☕`;

  return await scheduleNotification(title, body, notificationId, undefined, 'focusSanctuary');
};

// 8. Flashcards Spaced Repetition Review (Target: 'mindHack')
export const scheduleFlashcardReviewNotification = async (dueCount: number = 10): Promise<boolean> => {
  const notificationId = 30030;
  const title = `🃏 Flashcards Retention Review`;
  const body = `${dueCount} Biology & Chemistry flashcards pending for review! Keep your memory retention rate high 🧠`;

  return await scheduleNotification(title, body, notificationId, undefined, 'mindHack');
};

// 9. AI Neural Solver Response Alert (Target: 'liveAI')
export const scheduleNeuralSolverResponseNotification = async (doubtTitle: string): Promise<boolean> => {
  const notificationId = Math.floor(Math.random() * 900000) + 400000;
  const title = `🤖 AI Doubt Solver Answer Ready!`;
  const body = `Aapke doubt "${doubtTitle}" ka detailed step-by-step solution ready hai! Tap to view solution 🧪`;

  return await scheduleNotification(title, body, notificationId, undefined, 'liveAI');
};

// 10. NCERT Chapter Re-Read Reminder (Target: 'ncertHub')
export const scheduleNcertRereadNotification = async (chapterName: string): Promise<boolean> => {
  const notificationId = Math.abs(chapterName.split('').reduce((acc, c) => c.charCodeAt(0) + (acc << 5) - acc, 0)) % 100000;
  const title = `📖 NCERT Revision Reminder`;
  const body = `NCERT Chapter "${chapterName}" padhe hue 7 din ho gaye. Tap for a quick 10-minute NCERT skim! 🌿`;

  return await scheduleNotification(title, body, notificationId, undefined, 'ncertHub');
};

// 11. Rank Predictor Milestone Alert (Target: 'rankPredictor')
export const scheduleRankPredictorMilestoneNotification = async (predictedAIR: number): Promise<boolean> => {
  const notificationId = 50050;
  const title = `🏆 Rank Prediction Improvement!`;
  const body = `Recent test score ke mutabiq aapka Predicted NEET AIR ab #${predictedAIR} ho gaya hai! Tap to view GMC probability 🩺`;

  return await scheduleNotification(title, body, notificationId, undefined, 'rankPredictor');
};

// 12. Community & Direct Chat Notification (Target: 'neetCommunity')
export const scheduleCommunityChatNotification = async (senderName: string, messageSnippet: string): Promise<boolean> => {
  const notificationId = Math.floor(Math.random() * 900000) + 600000;
  const title = `💬 New Message from ${senderName}`;
  const body = `${messageSnippet} — Tap to open study group discussion! 📩`;

  return await scheduleNotification(title, body, notificationId, undefined, 'neetCommunity');
};
