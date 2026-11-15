
import React from 'react';
import { motion } from 'motion/react';
import { Target, Users, ShieldCheck, Award, TrendingUp, Heart } from 'lucide-react';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import { getSamplePagesByExam } from '../utils/sampleNotesPages';
import { ExamType } from '../types';

const About: React.FC = () => {
  const stats = [
    { label: 'Aspirants Helped', value: '50K+', icon: Users },
    { label: 'Exam Categories', value: '15+', icon: Target },
    { label: 'Success Rate', value: '85%', icon: TrendingUp },
    { label: 'Topper Curators', value: '100+', icon: Award },
  ];

  const sampleSheet = getSamplePagesByExam(ExamType.UPSC)[0];

  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="relative pt-16 pb-28 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-primary/5 -z-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <span className="px-4 py-2 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full uppercase tracking-widest inline-block">
              Our Story · NotesBazaar
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              Empowering Aspirants with <br /> <span className="premium-gradient-text">Topper-Verified</span> Knowledge.
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              Your one-stop destination for concise, exam-oriented handwritten notes for SSC, Banking, UPSC, and Government Exams.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-3"
            >
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
                <stat.icon size={24} />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-7">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
              Our Mission is to Bridge the Gap in Exam Preparation.
            </h2>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              We believe that the difference between success and failure in competitive exams often lies in the clarity and structure of revision notes. Our platform connects serious aspirants with curated handwritten notes from top rankers.
            </p>
            <div className="space-y-4">
              {[
                'Democratizing access to topper-level study material.',
                'Providing structured, zoom-clear handwritten content.',
                'Leveraging technology for instant, secure digital delivery.',
                'Building a community of successful, goal-oriented students.'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={14} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-[48px] overflow-hidden shadow-2xl bg-gradient-to-br from-blue-700 via-teal-700 to-emerald-600 p-6 flex flex-col justify-between">
              <div className="flex items-center gap-3 text-white">
                <NotesBazaarLogo variant="seal" size={56} className="rounded-full shadow-lg" />
                <div>
                  <p className="font-heading font-bold text-lg">CRACK YOUR EXAMS WITH US!</p>
                  <p className="text-xs text-teal-100">NotesBazaar • Your Study Partner</p>
                </div>
              </div>
              <div className="rounded-3xl overflow-hidden bg-white shadow-xl border border-white/25 mt-4 flex-1">
                <img src={sampleSheet} className="w-full h-full object-cover object-top" alt="NotesBazaar Sample Handwritten Note" />
              </div>
            </div>
            <div className="hidden sm:block absolute -bottom-8 -left-8 glass-card p-6 rounded-3xl max-w-[230px]">
              <Heart className="text-red-500 mb-3" size={28} fill="currentColor" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">Built with care for Indian Exam Aspirants.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
