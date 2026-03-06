import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet,
  getQuestionSets,
  getQuestionSet,
} from '../firebase/questionSets';
import { useAutoSave } from '../hooks/useAutoSave';

// ─── Constants ───────────────────────────────────────────────────────────────

const GAME_OPTIONS = [
  { value: 'multiple-choice', label: 'Multiple Choice', emoji: '🎯', color: 'bg-red-500' },
  { value: 'true-or-false', label: 'True or False', emoji: '✅', color: 'bg-green-500' },
  { value: 'word-cloud', label: 'Word Cloud', emoji: '☁️', color: 'bg-blue-500' },
  { value: 'puzzle', label: 'Puzzle', emoji: '🧩', color: 'bg-purple-500' },
  { value: 'type-answer', label: 'Type Answer', emoji: '⌨️', color: 'bg-orange-500' },
  { value: 'opinion-poll', label: 'Opinion Poll', emoji: '📊', color: 'bg-cyan-500' },
  { value: 'robot-run', label: 'Robot Run', emoji: '🤖', color: 'bg-pink-500' },
];

const CATEGORIES = ['vocabulary', 'conjugation', 'translation', 'culture', 'grammar', 'custom'];

const RECOMMENDED_COUNTS = {
  'multiple-choice': '5–15',
  'true-or-false': '8–20',
  'word-cloud': '3–8',
  'puzzle': '3–8',
  'type-answer': '5–12',
  'opinion-poll': '3–8',
  'robot-run': '10–20 across tiers',
};

const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

function emptyQuestion(gameType) {
  const base = { id: uid() };
  switch (gameType) {
    case 'multiple-choice':
      return { ...base, question: '', options: ['', '', '', ''], correct: 0, timeLimit: 20, imageUrl: '' };
    case 'true-or-false':
      return { ...base, statement: '', isTrue: false, timeLimit: 5 };
    case 'word-cloud':
      return { ...base, prompt: '', timeLimit: 30, hasCorrectAnswer: false, acceptedAnswers: [], category: 'poll' };
    case 'puzzle':
      return { ...base, question: '', items: ['', '', ''], correctOrder: [0, 1, 2], hint: '', timeLimit: 30 };
    case 'type-answer':
      return { ...base, question: '', acceptedAnswers: [], display: '', hint: '', timeLimit: 15, wordBank: [] };
    case 'opinion-poll':
      return { ...base, question: '', options: ['', '', '', ''], timeLimit: 20, discussionPrompt: '' };
    case 'robot-run':
      return { ...base, type: 'multiple-choice', tier: 1, question: '', options: ['', '', '', ''], correct: 0, points: 300 };
    default:
      return { ...base, question: '' };
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    title: 'Spanish Greetings — Basics',
    gameType: 'multiple-choice',
    category: 'vocabulary',
    questions: [
      { question: "¿Cómo se dice 'Hello'?", options: ['Hola', 'Adiós', 'Gracias', 'Por favor'], correct: 0, timeLimit: 15 },
      { question: "¿Cómo se dice 'Goodbye'?", options: ['Hola', 'Adiós', 'Buenos días', 'Hasta luego'], correct: 1, timeLimit: 15 },
      { question: "¿Cómo se dice 'Please'?", options: ['Gracias', 'De nada', 'Por favor', 'Perdón'], correct: 2, timeLimit: 15 },
      { question: "¿Cómo se dice 'Thank you'?", options: ['Por favor', 'Gracias', 'Hola', 'Sí'], correct: 1, timeLimit: 15 },
      { question: "¿Cómo se dice 'Good morning'?", options: ['Buenas noches', 'Buenas tardes', 'Buenos días', 'Buenas'], correct: 2, timeLimit: 15 },
    ],
  },
  {
    title: 'Numbers 1–10 True/False',
    gameType: 'true-or-false',
    category: 'vocabulary',
    questions: [
      { statement: "'Uno' means the number 1 in Spanish.", isTrue: true, timeLimit: 5 },
      { statement: "'Tres' means the number 5 in Spanish.", isTrue: false, timeLimit: 5 },
      { statement: "'Diez' means the number 10 in Spanish.", isTrue: true, timeLimit: 5 },
      { statement: "'Ocho' means the number 6 in Spanish.", isTrue: false, timeLimit: 5 },
      { statement: "'Cinco' means the number 5 in Spanish.", isTrue: true, timeLimit: 5 },
    ],
  },
  {
    title: 'Verb Conjugation — Present Tense',
    gameType: 'type-answer',
    category: 'conjugation',
    questions: [
      { question: "Conjugate 'hablar' for 'yo'", acceptedAnswers: ['hablo'], display: 'hablo', hint: 'Ends in -o', timeLimit: 15 },
      { question: "Conjugate 'hablar' for 'tú'", acceptedAnswers: ['hablas'], display: 'hablas', hint: 'Ends in -as', timeLimit: 15 },
      { question: "Conjugate 'comer' for 'yo'", acceptedAnswers: ['como'], display: 'como', hint: 'Ends in -o', timeLimit: 15 },
      { question: "Conjugate 'vivir' for 'nosotros'", acceptedAnswers: ['vivimos'], display: 'vivimos', hint: 'Ends in -imos', timeLimit: 20 },
    ],
  },
  {
    title: 'Spanish-Speaking Countries Poll',
    gameType: 'opinion-poll',
    category: 'culture',
    questions: [
      { question: 'Which country would you most like to visit?', options: ['🇲🇽 Mexico', '🇪🇸 Spain', '🇨🇴 Colombia', '🇦🇷 Argentina'], timeLimit: 20, discussionPrompt: 'What do you know about that country?' },
      { question: 'Which Spanish accent do you find easiest to understand?', options: ['🇲🇽 Mexican', '🇪🇸 Spanish', '🇨🇴 Colombian', '🇦🇷 Argentine'], timeLimit: 20, discussionPrompt: 'Have you heard all of these accents?' },
    ],
  },
  {
    title: 'Sentence Builder — Basic Phrases',
    gameType: 'puzzle',
    category: 'grammar',
    questions: [
      { question: "Build: 'I want to eat tacos'", items: ['tacos', 'Yo', 'comer', 'quiero'], correctOrder: [1, 3, 2, 0], hint: 'Subject → verb → infinitive → object', timeLimit: 30 },
      { question: "Build: 'Good morning, how are you?'", items: ['¿cómo', 'Buenos', 'estás?', 'días,'], correctOrder: [1, 3, 0, 2], hint: 'Start with the greeting', timeLimit: 30 },
    ],
  },
  {
    title: 'Space Station Español — Beginner',
    gameType: 'robot-run',
    category: 'vocabulary',
    questions: [
      { type: 'multiple-choice', tier: 1, question: "¿Cómo se dice 'hello'?", options: ['Hola', 'Adiós', 'Gracias', 'Por favor'], correct: 0, points: 300 },
      { type: 'true-false', tier: 1, question: "'Agua' means water in Spanish.", isTrue: true, points: 300 },
      { type: 'multiple-choice', tier: 2, question: "Which is correct for 'I speak'?", options: ['hablas', 'hablo', 'habla', 'hablan'], correct: 1, points: 500 },
      { type: 'true-false', tier: 2, question: "'Ser' and 'Estar' both mean 'to be'.", isTrue: true, points: 500 },
      { type: 'multiple-choice', tier: 3, question: "What is the preterite of 'ir' for 'él'?", options: ['iba', 'fue', 'va', 'irá'], correct: 1, points: 800 },
    ],
  },
];

// ─── Sortable Question Card ─────────────────────────────────────────────────

function SortableQuestionCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

// ─── Tag Input ───────────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const handleKey = (e) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      onChange([...tags, input.trim()]);
      setInput('');
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };
  return (
    <div className="flex flex-wrap gap-1 bg-slate-700 rounded-lg p-2 min-h-[42px]">
      {tags.map((t, i) => (
        <span key={i} className="bg-slate-600 text-white text-sm px-2 py-1 rounded flex items-center gap-1">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="bg-transparent text-white text-sm outline-none flex-1 min-w-[100px]"
      />
    </div>
  );
}

// ─── Question Forms Per Game Type ────────────────────────────────────────────

function MultipleChoiceForm({ q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  const setOption = (i, v) => { const opts = [...q.options]; opts[i] = v; set('options', opts); };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Question</label>
        <textarea value={q.question} onChange={(e) => set('question', e.target.value)} rows={2}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Time Limit: {q.timeLimit}s</label>
        <input type="range" min={5} max={30} value={q.timeLimit} onChange={(e) => set('timeLimit', +e.target.value)}
          className="w-full accent-yellow-400" />
      </div>
      <div className="space-y-2">
        <label className="block text-slate-300 text-sm font-semibold">Options (select correct)</label>
        {['A', 'B', 'C', 'D'].map((letter, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name={`correct-${q.id}`} checked={q.correct === i} onChange={() => set('correct', i)}
              className="accent-green-400 w-4 h-4" />
            <span className="text-slate-400 text-sm font-mono w-5">{letter}</span>
            <input value={q.options[i] || ''} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${letter}`}
              className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Image URL (optional)</label>
        <input value={q.imageUrl || ''} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://..."
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
    </div>
  );
}

function TrueOrFalseForm({ q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Statement</label>
        <textarea value={q.statement || ''} onChange={(e) => set('statement', e.target.value)} rows={2}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Time Limit: {q.timeLimit}s</label>
        <input type="range" min={5} max={30} value={q.timeLimit} onChange={(e) => set('timeLimit', +e.target.value)}
          className="w-full accent-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-2">Correct Answer</label>
        <div className="flex gap-3">
          <button type="button" onClick={() => set('isTrue', true)}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${q.isTrue ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
            True
          </button>
          <button type="button" onClick={() => set('isTrue', false)}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${!q.isTrue ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
            False
          </button>
        </div>
      </div>
    </div>
  );
}

function WordCloudForm({ q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Prompt</label>
        <textarea value={q.prompt || ''} onChange={(e) => set('prompt', e.target.value)} rows={2}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Time Limit: {q.timeLimit}s</label>
        <input type="range" min={5} max={60} value={q.timeLimit} onChange={(e) => set('timeLimit', +e.target.value)}
          className="w-full accent-yellow-400" />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-slate-300 text-sm font-semibold">Has Correct Answer?</label>
        <button type="button" onClick={() => set('hasCorrectAnswer', !q.hasCorrectAnswer)}
          className={`w-12 h-6 rounded-full transition-colors relative ${q.hasCorrectAnswer ? 'bg-green-500' : 'bg-slate-600'}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${q.hasCorrectAnswer ? 'left-[26px]' : 'left-0.5'}`} />
        </button>
      </div>
      {q.hasCorrectAnswer && (
        <div>
          <label className="block text-slate-300 text-sm font-semibold mb-1">Accepted Answers (press Enter to add)</label>
          <TagInput tags={q.acceptedAnswers || []} onChange={(v) => set('acceptedAnswers', v)} placeholder="Type an answer and press Enter" />
        </div>
      )}
    </div>
  );
}

function PuzzleForm({ q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  const setItem = (i, v) => { const items = [...q.items]; items[i] = v; set('items', items); };
  const addItem = () => {
    if (q.items.length < 6) {
      set('items', [...q.items, '']);
      set('correctOrder', [...q.correctOrder, q.items.length]);
    }
  };
  const removeItem = (i) => {
    const items = q.items.filter((_, j) => j !== i);
    const order = q.correctOrder.filter((v) => v !== i).map((v) => (v > i ? v - 1 : v));
    onChange({ ...q, items, correctOrder: order });
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Question</label>
        <textarea value={q.question || ''} onChange={(e) => set('question', e.target.value)} rows={2}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Time Limit: {q.timeLimit}s</label>
        <input type="range" min={10} max={60} value={q.timeLimit} onChange={(e) => set('timeLimit', +e.target.value)}
          className="w-full accent-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-2">Items (drag to set correct order)</label>
        {q.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <span className="text-slate-500 text-xs font-mono w-5">{i + 1}</span>
            <input value={item} onChange={(e) => setItem(i, e.target.value)} placeholder={`Item ${i + 1}`}
              className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            {q.items.length > 2 && (
              <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 text-sm px-2">Remove</button>
            )}
          </div>
        ))}
        {q.items.length < 6 && (
          <button type="button" onClick={addItem} className="text-yellow-400 hover:text-yellow-300 text-sm font-semibold">+ Add Item</button>
        )}
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Correct Order (comma-separated indices, 0-based)</label>
        <input value={(q.correctOrder || []).join(', ')} onChange={(e) => set('correctOrder', e.target.value.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)))}
          placeholder="e.g. 1, 3, 2, 0"
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Hint (optional)</label>
        <input value={q.hint || ''} onChange={(e) => set('hint', e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
    </div>
  );
}

function TypeAnswerForm({ q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Question</label>
        <textarea value={q.question || ''} onChange={(e) => set('question', e.target.value)} rows={2}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Time Limit: {q.timeLimit}s</label>
        <input type="range" min={5} max={30} value={q.timeLimit} onChange={(e) => set('timeLimit', +e.target.value)}
          className="w-full accent-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Accepted Answers (press Enter to add)</label>
        <TagInput tags={q.acceptedAnswers || []} onChange={(v) => set('acceptedAnswers', v)} placeholder="Type an answer and press Enter" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Display Text</label>
        <input value={q.display || ''} onChange={(e) => set('display', e.target.value)} placeholder="Shown after answering"
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Hint (optional)</label>
        <input value={q.hint || ''} onChange={(e) => set('hint', e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Word Bank (press Enter to add letters/words)</label>
        <TagInput tags={q.wordBank || []} onChange={(v) => set('wordBank', v)} placeholder="Optional word bank entries" />
      </div>
    </div>
  );
}

function OpinionPollForm({ q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  const setOption = (i, v) => { const opts = [...q.options]; opts[i] = v; set('options', opts); };
  const addOption = () => { if (q.options.length < 4) set('options', [...q.options, '']); };
  const removeOption = (i) => { if (q.options.length > 2) set('options', q.options.filter((_, j) => j !== i)); };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Question</label>
        <textarea value={q.question || ''} onChange={(e) => set('question', e.target.value)} rows={2}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Time Limit: {q.timeLimit}s</label>
        <input type="range" min={5} max={30} value={q.timeLimit} onChange={(e) => set('timeLimit', +e.target.value)}
          className="w-full accent-yellow-400" />
      </div>
      <div className="space-y-2">
        <label className="block text-slate-300 text-sm font-semibold">Options (2–4)</label>
        {q.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`}
              className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            {q.options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} className="text-red-400 hover:text-red-300 text-sm px-2">Remove</button>
            )}
          </div>
        ))}
        {q.options.length < 4 && (
          <button type="button" onClick={addOption} className="text-yellow-400 hover:text-yellow-300 text-sm font-semibold">+ Add Option</button>
        )}
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Discussion Prompt (optional)</label>
        <textarea value={q.discussionPrompt || ''} onChange={(e) => set('discussionPrompt', e.target.value)} rows={2}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
    </div>
  );
}

function RobotRunForm({ q, onChange }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  const tierPoints = { 1: 300, 2: 500, 3: 800 };
  const setTier = (t) => onChange({ ...q, tier: t, points: tierPoints[t] });
  const setSubType = (type) => {
    if (type === 'true-false') {
      onChange({ ...q, type, statement: q.question || '', isTrue: false });
    } else {
      onChange({ ...q, type, options: q.options || ['', '', '', ''], correct: q.correct || 0 });
    }
  };
  const setOption = (i, v) => { const opts = [...(q.options || ['', '', '', ''])]; opts[i] = v; set('options', opts); };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-slate-300 text-sm font-semibold mb-1">Sub-type</label>
          <select value={q.type || 'multiple-choice'} onChange={(e) => setSubType(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
            <option value="multiple-choice">Multiple Choice</option>
            <option value="true-false">True / False</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-300 text-sm font-semibold mb-1">Tier</label>
          <div className="flex gap-2">
            {[1, 2, 3].map((t) => (
              <button key={t} type="button" onClick={() => setTier(t)}
                className={`w-10 h-10 rounded-lg font-bold text-sm transition-colors ${q.tier === t ? 'bg-yellow-400 text-black' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-slate-300 text-sm font-semibold mb-1">Points</label>
          <span className="text-yellow-400 font-bold text-lg">{q.points}</span>
        </div>
      </div>
      <div>
        <label className="block text-slate-300 text-sm font-semibold mb-1">Question</label>
        <textarea value={q.question || ''} onChange={(e) => set('question', e.target.value)} rows={2}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
      </div>
      {(q.type || 'multiple-choice') === 'multiple-choice' ? (
        <div className="space-y-2">
          <label className="block text-slate-300 text-sm font-semibold">Options (select correct)</label>
          {['A', 'B', 'C', 'D'].map((letter, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name={`rr-correct-${q.id}`} checked={q.correct === i} onChange={() => set('correct', i)}
                className="accent-green-400 w-4 h-4" />
              <span className="text-slate-400 text-sm font-mono w-5">{letter}</span>
              <input value={(q.options || [])[i] || ''} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${letter}`}
                className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
          ))}
        </div>
      ) : (
        <div>
          <label className="block text-slate-300 text-sm font-semibold mb-2">Correct Answer</label>
          <div className="flex gap-3">
            <button type="button" onClick={() => set('isTrue', true)}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${q.isTrue ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
              True
            </button>
            <button type="button" onClick={() => set('isTrue', false)}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${!q.isTrue ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
              False
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionForm({ gameType, question, onChange }) {
  switch (gameType) {
    case 'multiple-choice': return <MultipleChoiceForm q={question} onChange={onChange} />;
    case 'true-or-false': return <TrueOrFalseForm q={question} onChange={onChange} />;
    case 'word-cloud': return <WordCloudForm q={question} onChange={onChange} />;
    case 'puzzle': return <PuzzleForm q={question} onChange={onChange} />;
    case 'type-answer': return <TypeAnswerForm q={question} onChange={onChange} />;
    case 'opinion-poll': return <OpinionPollForm q={question} onChange={onChange} />;
    case 'robot-run': return <RobotRunForm q={question} onChange={onChange} />;
    default: return <p className="text-slate-500 text-sm">Select a game type first.</p>;
  }
}

// ─── Question Preview Text ───────────────────────────────────────────────────

function questionPreview(gameType, q) {
  switch (gameType) {
    case 'true-or-false': return q.statement || 'Untitled statement';
    case 'word-cloud': return q.prompt || 'Untitled prompt';
    default: return q.question || 'Untitled question';
  }
}

// ─── Templates Modal ─────────────────────────────────────────────────────────

function TemplatesModal({ onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-bold">Browse Templates</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((tpl, i) => {
            const game = GAME_OPTIONS.find((g) => g.value === tpl.gameType);
            return (
              <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-500 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-semibold text-sm">{tpl.title}</h3>
                  <span className={`${game?.color} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>{game?.emoji} {game?.label}</span>
                </div>
                <p className="text-slate-400 text-xs mb-1">{tpl.category} &middot; {tpl.questions.length} questions</p>
                <p className="text-slate-500 text-xs mb-3 truncate">{questionPreview(tpl.gameType, tpl.questions[0])}</p>
                <button onClick={() => onSelect(tpl)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm px-4 py-1.5 rounded-lg transition-colors">
                  Use Template
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="bg-slate-900 rounded-xl p-6 max-w-sm w-full border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <p className="text-white mb-4">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 text-sm font-bold">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LibrarySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
          <div className="flex gap-2 mb-2">
            <div className="h-5 bg-slate-700 rounded-full w-20" />
            <div className="h-5 bg-slate-700 rounded-full w-16" />
          </div>
          <div className="h-3 bg-slate-700 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const QuestionEditor = () => {
  const { questionSetId } = useParams();
  const navigate = useNavigate();

  // Library state
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Editor state
  const [activeSet, setActiveSet] = useState(null);
  const [expandedQ, setExpandedQ] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [showTemplates, setShowTemplates] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [mobileTab, setMobileTab] = useState('library');

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Auto-save ref
  const autoSaveTimer = useRef(null);
  const questionsEndRef = useRef(null);

  // ─── Fetch Library ──────────────────────────────────────────────────────

  const fetchSets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getQuestionSets(filterType === 'all' ? null : filterType);
      setSets(data);
    } catch {
      setSets([]);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchSets(); }, [fetchSets]);

  // Load set from URL param
  useEffect(() => {
    if (questionSetId) {
      (async () => {
        try {
          const s = await getQuestionSet(questionSetId);
          if (s) setActiveSet(s);
        } catch { /* ignore */ }
      })();
    }
  }, [questionSetId]);

  // ─── Auto-save ──────────────────────────────────────────────────────────

  const triggerAutoSave = useCallback((set) => {
    if (!set?.id) return;
    clearTimeout(autoSaveTimer.current);
    setSaveStatus('saving');
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await updateQuestionSet(set.id, {
          title: set.title,
          gameType: set.gameType,
          category: set.category,
          questions: set.questions,
          questionCount: set.questions.length,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch {
        setSaveStatus('error');
      }
    }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, []);

  // ─── CRUD Helpers ───────────────────────────────────────────────────────

  const handleNewSet = () => {
    setActiveSet({
      id: null,
      title: '',
      gameType: 'multiple-choice',
      category: 'vocabulary',
      questions: [emptyQuestion('multiple-choice')],
    });
    setExpandedQ(0);
    setMobileTab('editor');
  };

  const handleSave = async () => {
    if (!activeSet) return;
    setSaveStatus('saving');
    try {
      if (activeSet.id) {
        await updateQuestionSet(activeSet.id, {
          title: activeSet.title || 'Untitled Question Set',
          gameType: activeSet.gameType,
          category: activeSet.category,
          questions: activeSet.questions,
          questionCount: activeSet.questions.length,
        });
      } else {
        const id = await createQuestionSet({
          title: activeSet.title || 'Untitled Question Set',
          gameType: activeSet.gameType,
          category: activeSet.category,
          questions: activeSet.questions,
          questionCount: activeSet.questions.length,
        });
        setActiveSet((prev) => ({ ...prev, id }));
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
      fetchSets();
    } catch {
      setSaveStatus('error');
    }
  };

  const handleSaveAndLaunch = async () => {
    await handleSave();
    navigate('/teacher');
  };

  const handleDelete = (setToDelete) => {
    setConfirmDialog({
      message: `Delete "${setToDelete.title || 'Untitled'}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteQuestionSet(setToDelete.id);
          if (activeSet?.id === setToDelete.id) setActiveSet(null);
          fetchSets();
        } catch { /* ignore */ }
        setConfirmDialog(null);
      },
    });
  };

  const handleSelectSet = (s) => {
    setActiveSet({ ...s });
    setExpandedQ(null);
    setMobileTab('editor');
  };

  // ─── Game Type Change ───────────────────────────────────────────────────

  const handleGameTypeChange = (newType) => {
    if (activeSet.questions.length > 0) {
      setConfirmDialog({
        message: 'Changing game type will clear all questions. Continue?',
        onConfirm: () => {
          const updated = { ...activeSet, gameType: newType, questions: [emptyQuestion(newType)] };
          setActiveSet(updated);
          setExpandedQ(0);
          triggerAutoSave(updated);
          setConfirmDialog(null);
        },
      });
    } else {
      setActiveSet((prev) => ({ ...prev, gameType: newType }));
    }
  };

  // ─── Question Operations ────────────────────────────────────────────────

  const updateQuestion = (index, q) => {
    const questions = [...activeSet.questions];
    questions[index] = q;
    const updated = { ...activeSet, questions };
    setActiveSet(updated);
    triggerAutoSave(updated);
  };

  const addQuestion = () => {
    const q = emptyQuestion(activeSet.gameType);
    const updated = { ...activeSet, questions: [...activeSet.questions, q] };
    setActiveSet(updated);
    setExpandedQ(updated.questions.length - 1);
    setTimeout(() => questionsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const duplicateQuestion = (index) => {
    const q = { ...activeSet.questions[index], id: uid() };
    const questions = [...activeSet.questions];
    questions.splice(index + 1, 0, q);
    const updated = { ...activeSet, questions };
    setActiveSet(updated);
    setExpandedQ(index + 1);
    triggerAutoSave(updated);
  };

  const deleteQuestion = (index) => {
    const questions = activeSet.questions.filter((_, i) => i !== index);
    const updated = { ...activeSet, questions };
    setActiveSet(updated);
    if (expandedQ === index) setExpandedQ(null);
    else if (expandedQ > index) setExpandedQ(expandedQ - 1);
    triggerAutoSave(updated);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = activeSet.questions.findIndex((q) => q.id === active.id);
      const newIndex = activeSet.questions.findIndex((q) => q.id === over.id);
      const questions = arrayMove(activeSet.questions, oldIndex, newIndex);
      const updated = { ...activeSet, questions };
      setActiveSet(updated);
      if (expandedQ === oldIndex) setExpandedQ(newIndex);
      triggerAutoSave(updated);
    }
  };

  // ─── Template ───────────────────────────────────────────────────────────

  const handleUseTemplate = (tpl) => {
    const questions = tpl.questions.map((q) => ({ ...q, id: uid() }));
    setActiveSet({
      id: null,
      title: tpl.title,
      gameType: tpl.gameType,
      category: tpl.category,
      questions,
    });
    setExpandedQ(null);
    setShowTemplates(false);
    setMobileTab('editor');
  };

  // ─── Inline set field update ────────────────────────────────────────────

  const updateSetField = (field, value) => {
    const updated = { ...activeSet, [field]: value };
    setActiveSet(updated);
    triggerAutoSave(updated);
  };

  // ─── Filter sets ────────────────────────────────────────────────────────

  const filteredSets = sets.filter((s) => {
    if (search && !s.title?.toLowerCase().includes(search.toLowerCase()) && !s.category?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ─── Game badge helper ──────────────────────────────────────────────────

  const gameMeta = (type) => GAME_OPTIONS.find((g) => g.value === type) || {};

  // ─── Save status indicator ──────────────────────────────────────────────

  const saveIndicator = () => {
    switch (saveStatus) {
      case 'saving': return <span className="text-yellow-400 text-xs">Saving...</span>;
      case 'saved': return <span className="text-green-400 text-xs">Saved</span>;
      case 'error': return (
        <span className="text-red-400 text-xs cursor-pointer" onClick={handleSave}>
          Save failed — click to retry
        </span>
      );
      default: return null;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Nav */}
      <nav className="bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0" style={{ height: '52px' }}>
        <Link to="/">
          <img src="/logo_hires_white.png" alt="SpanishVIP" className="h-8 object-contain" />
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/teacher" className="text-slate-400 hover:text-white text-sm transition-colors">
            &larr; Back to Dashboard
          </Link>
          <span className="text-slate-400 font-semibold text-sm hidden sm:inline">Question Editor</span>
        </div>
      </nav>

      {/* Mobile tabs */}
      <div className="lg:hidden flex border-b border-slate-800">
        <button onClick={() => setMobileTab('library')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${mobileTab === 'library' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-500'}`}>
          Library
        </button>
        <button onClick={() => setMobileTab('editor')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${mobileTab === 'editor' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-500'}`}>
          Editor
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel — Library ── */}
        <div className={`w-full lg:w-[35%] bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto ${mobileTab !== 'library' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 space-y-3">
            <button onClick={handleNewSet}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-xl transition-colors text-sm">
              + New Question Set
            </button>
            <button onClick={() => setShowTemplates(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm border border-slate-700">
              Browse Templates
            </button>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or category..."
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          </div>

          {/* Filter tabs */}
          <div className="px-4 pb-2 flex flex-wrap gap-1">
            {[{ value: 'all', label: 'All' }, ...GAME_OPTIONS.map((g) => ({ value: g.value, label: g.emoji }))].map((f) => (
              <button key={f.value} onClick={() => setFilterType(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterType === f.value ? 'bg-yellow-400 text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 px-4 pb-4 space-y-2 overflow-y-auto">
            {loading ? (
              <LibrarySkeleton />
            ) : filteredSets.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📝</p>
                <p className="text-slate-500 text-sm">No question sets yet.</p>
                <button onClick={handleNewSet} className="text-yellow-400 hover:text-yellow-300 text-sm font-semibold mt-2">
                  Create your first one &rarr;
                </button>
              </div>
            ) : (
              filteredSets.map((s) => {
                const gm = gameMeta(s.gameType);
                return (
                  <div key={s.id}
                    className={`bg-slate-800 rounded-xl p-3 border transition-colors cursor-pointer ${activeSet?.id === s.id ? 'border-yellow-400' : 'border-slate-700 hover:border-slate-500'}`}
                    onClick={() => handleSelectSet(s)}>
                    <h3 className="text-white font-semibold text-sm truncate mb-1">{s.title || 'Untitled'}</h3>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className={`${gm.color || 'bg-slate-600'} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>
                        {gm.emoji} {gm.label}
                      </span>
                      <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{s.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs">{s.questionCount || s.questions?.length || 0} questions</span>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleSelectSet(s)} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Edit</button>
                        <button onClick={() => handleDelete(s)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Delete</button>
                        <Link to={`/teacher`} className="text-yellow-400 hover:text-yellow-300 text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={(e) => e.stopPropagation()}>
                          Use in Game &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel — Editor ── */}
        <div className={`w-full lg:w-[65%] bg-slate-950 flex flex-col overflow-y-auto ${mobileTab !== 'editor' ? 'hidden lg:flex' : 'flex'}`}>
          {!activeSet ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-5xl mb-4">✏️</p>
                <p className="text-slate-500">Select a question set to edit or create a new one.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 lg:p-6 space-y-4">
              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <input value={activeSet.title} onChange={(e) => updateSetField('title', e.target.value)}
                    placeholder="Name your question set..."
                    className="flex-1 bg-transparent text-white text-xl lg:text-2xl font-bold border-b-2 border-slate-700 focus:border-yellow-400 outline-none pb-1 transition-colors" />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {saveIndicator()}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  <select value={activeSet.gameType} onChange={(e) => handleGameTypeChange(e.target.value)}
                    className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                    {GAME_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>{g.emoji} {g.label}</option>
                    ))}
                  </select>
                  <select value={activeSet.category} onChange={(e) => updateSetField('category', e.target.value)}
                    className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 capitalize">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="flex-1" />
                  <span className="text-slate-400 text-sm">{activeSet.questions.length} question{activeSet.questions.length !== 1 ? 's' : ''}
                    <span className="text-slate-600 ml-1" title={`Recommended: ${RECOMMENDED_COUNTS[activeSet.gameType]}`}>
                      (rec: {RECOMMENDED_COUNTS[activeSet.gameType]})
                    </span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleSave}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-5 py-2 rounded-lg transition-colors text-sm">
                    Save
                  </button>
                  <button onClick={handleSaveAndLaunch}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-5 py-2 rounded-lg transition-colors text-sm">
                    Save &amp; Launch
                  </button>
                </div>
              </div>

              {/* Questions */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activeSet.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {activeSet.questions.map((q, i) => (
                      <SortableQuestionCard key={q.id} id={q.id}>
                        {({ dragHandleProps }) => (
                          <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                            {/* Card header */}
                            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpandedQ(expandedQ === i ? null : i)}>
                              <span {...dragHandleProps} className="text-slate-600 hover:text-slate-400 cursor-grab select-none text-lg" onClick={(e) => e.stopPropagation()}>
                                ⠿
                              </span>
                              <span className="bg-slate-700 text-slate-300 text-xs font-bold w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
                                {i + 1}
                              </span>
                              <span className="text-white text-sm truncate flex-1">
                                {questionPreview(activeSet.gameType, q)}
                              </span>
                              <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => duplicateQuestion(i)} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1" title="Duplicate">
                                  Dup
                                </button>
                                <button onClick={() => deleteQuestion(i)} className="text-red-500 hover:text-red-300 text-xs px-2 py-1" title="Delete">
                                  Del
                                </button>
                              </div>
                              <span className="text-slate-600 text-sm transition-transform" style={{ transform: expandedQ === i ? 'rotate(180deg)' : 'rotate(0)' }}>
                                ▾
                              </span>
                            </div>
                            {/* Expanded form */}
                            {expandedQ === i && (
                              <div className="bg-slate-800 rounded-b-xl p-4 border-t border-slate-700">
                                <QuestionForm gameType={activeSet.gameType} question={q} onChange={(updated) => updateQuestion(i, updated)} />
                              </div>
                            )}
                          </div>
                        )}
                      </SortableQuestionCard>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button onClick={addQuestion}
                className="w-full bg-slate-900 hover:bg-slate-800 border-2 border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                + Add Question
              </button>
              <div ref={questionsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showTemplates && <TemplatesModal onSelect={handleUseTemplate} onClose={() => setShowTemplates(false)} />}
      {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
    </div>
  );
};

export default QuestionEditor;
