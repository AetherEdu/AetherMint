"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export interface CourseProgress {
  courseId: string;
  courseName: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  lastAccessed: string;
}

export interface LearningStats {
  week: string;
  hoursSpent: number;
  lessonsCompleted: number;
}

interface ProgressChartProps {
  courses: CourseProgress[];
  stats: LearningStats[];
}

export function ProgressChart({ courses, stats }: ProgressChartProps) {
  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

  // Calculate overall stats
  const totalProgress =
    courses.length > 0
      ? Math.round(
          courses.reduce((sum, c) => sum + c.progress, 0) / courses.length,
        )
      : 0;

  const completedCourses = courses.filter((c) => c.progress === 100).length;
  const inProgressCourses = courses.filter(
    (c) => c.progress > 0 && c.progress < 100,
  ).length;

  return (
    <div className="w-full space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            Overall Progress
          </div>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-bold text-blue-600">
              {totalProgress}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {courses.length} courses
            </div>
          </div>
          <div className="mt-4 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            Completed
          </div>
          <div className="text-3xl font-bold text-green-600">
            {completedCourses}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            courses finished
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            In Progress
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {inProgressCourses}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            active courses
          </div>
        </div>
      </div>

      {/* Course Progress List */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Course Progress
        </h3>
        <div className="space-y-6">
          {courses.map((course) => (
            <div key={course.courseId} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {course.courseName}
                  </h4>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                    {course.progress}%
                  </span>
                </div>
                <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>
                    {course.completedLessons}/{course.totalLessons} lessons
                  </span>
                  <span>•</span>
                  <span>Last accessed: {course.lastAccessed}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Learning Stats Chart */}
      {stats.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Weekly Learning Activity
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="week" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#f3f4f6" }}
              />
              <Legend />
              <Bar
                dataKey="hoursSpent"
                fill="#3b82f6"
                name="Hours Spent"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="lessonsCompleted"
                fill="#8b5cf6"
                name="Lessons Completed"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Progress Distribution Pie Chart */}
      {courses.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Progress Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: "Completed", value: completedCourses },
                  { name: "In Progress", value: inProgressCourses },
                  {
                    name: "Not Started",
                    value:
                      courses.length - completedCourses - inProgressCourses,
                  },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) =>
                  `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#f3f4f6",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
