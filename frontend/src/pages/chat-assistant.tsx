import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GetServerSideProps, NextPage } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { ChatAssistant } from '@/components/Chat/ChatAssistant';
import { useCourseStore } from '@/store/courseStore';

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'en', [
      'common',
      'navigation',
    ])),
  },
});

const ChatAssistantPage: NextPage = () => {
  const { t } = useTranslation(['common']);
  const { loadAvailableCourses, setCurrentCourse } = useCourseStore();
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Load available courses on mount
    loadAvailableCourses();
  }, [loadAvailableCourses]);

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    const course = useCourseStore.getState().availableCourses.find(c => c.id === courseId);
    if (course) {
      setCurrentCourse(course);
    }
    setIsMobileMenuOpen(false);
  };

  const { availableCourses } = useCourseStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {t('chat.title', 'AI Learning Assistant')}
              </h1>
            </div>
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Course Selection Sidebar */}
          <aside className={`${isMobileMenuOpen ? 'block' : 'hidden'} lg:block lg:col-span-1`}>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('chat.selectCourse', 'Select Course')}
              </h2>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedCourseId('');
                    setCurrentCourse(null);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    !selectedCourseId
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {t('chat.generalChat', 'General Chat')}
                </button>
                
                {availableCourses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => handleCourseSelect(course.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedCourseId === course.id
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{course.title}</div>
                    <div className="text-xs text-gray-500">{course.difficulty}</div>
                  </button>
                ))}
              </div>

              {/* Study Stats */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {t('chat.yourProgress', 'Your Progress')}
              </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {t('chat.studyStreak', 'Study Streak')}
                    </span>
                    <span className="font-medium text-gray-900">
                      {useCourseStore.getState().studyStreak} days
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {t('chat.totalStudyTime', 'Total Study Time')}
                    </span>
                    <span className="font-medium text-gray-900">
                      {Math.floor(useCourseStore.getState().totalStudyTime / 60)}h {useCourseStore.getState().totalStudyTime % 60}m
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Chat Area */}
          <main className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md h-[calc(100vh-200px)] lg:h-[600px]">
              <ChatAssistant 
                courseId={selectedCourseId || undefined}
                className="h-full"
              />
            </div>

            {/* Features Cards */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900">Voice Input</h3>
                </div>
                <p className="text-sm text-gray-600">Use your voice to ask questions and get responses hands-free.</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900">Multi-Language</h3>
                </div>
                <p className="text-sm text-gray-600">Get help in your preferred language with support for 12+ languages.</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900">Context-Aware</h3>
                </div>
                <p className="text-sm text-gray-600">Get personalized help based on your current course and progress.</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistantPage;
