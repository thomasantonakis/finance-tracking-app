import React from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';

export default function CalendarGrid({ 
  currentDate, 
  expenses, 
  income, 
  transfers,
  selectedDate, 
  onSelectDate,
  onDoubleClick,
  collapsed = false 
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekStart = startOfWeek(selectedDate || new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate || new Date(), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const displayDays = collapsed ? weekDays : days;

  const getDayData = (day) => {
    const dayExpenses = expenses.filter(e => 
      isSameDay(new Date(e.date), day)
    ).reduce((sum, e) => sum + (e.amount || 0), 0);

    const dayIncome = income.filter(i => 
      isSameDay(new Date(i.date), day)
    ).reduce((sum, i) => sum + (i.amount || 0), 0);

    const dayTransfers = transfers.filter(t => 
      isSameDay(new Date(t.date), day)
    ).reduce((sum, t) => sum + (t.amount || 0), 0);

    return { expenses: dayExpenses, income: dayIncome, transfers: dayTransfers };
  };

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const isWeekend = (day) => {
    const idx = day.getDay();
    return idx === 0 || idx === 6;
  };

  return (
    <div className="bg-white rounded-xl p-2 border border-slate-200">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((day) => (
          <div key={day} className="text-center text-[10px] text-slate-500 font-medium py-0.5">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {displayDays.map((day, index) => {
          const { expenses: dayExpenses, income: dayIncome, transfers: dayTransfers } = getDayData(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDay = isToday(day);
          const hasData = dayExpenses > 0 || dayIncome > 0 || dayTransfers > 0;
          const weekend = isWeekend(day);

          return (
            <motion.button
              key={day.toString()}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.01 }}
              onClick={() => onSelectDate(day)}
              onDoubleClick={() => onDoubleClick && onDoubleClick(day)}
              className={`relative h-20 rounded-md p-1 transition-all border ${
                isTodayDay
                  ? 'bg-blue-500 border-blue-600'
                  : isSelected
                  ? 'bg-slate-200 border-slate-400'
                  : weekend
                  ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  : 'border-slate-200 hover:bg-slate-50'
              } ${!isCurrentMonth && !collapsed ? 'opacity-30' : ''}`}
            >
              <div className="flex flex-col items-center justify-start h-full">
                <span className={`text-sm font-bold leading-tight ${
                  isTodayDay ? 'text-white' : 'text-slate-900'
                }`}>
                  {format(day, 'd')}
                </span>
                {hasData && (
                  <div className="text-[10px] leading-tight space-y-0 w-full">
                    {dayIncome > 0 && (
                      <div className={`font-semibold ${isTodayDay ? 'text-white' : 'text-green-600'}`}>
                        {Math.round(dayIncome)}
                      </div>
                    )}
                    {dayExpenses > 0 && (
                      <div className={`font-semibold ${isTodayDay ? 'text-white' : 'text-red-600'}`}>
                        {Math.round(dayExpenses)}
                      </div>
                    )}
                    {dayTransfers > 0 && (
                      <div className={`font-medium ${isTodayDay ? 'text-white opacity-70' : 'text-slate-400'}`}>
                        {Math.round(dayTransfers)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
