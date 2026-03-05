import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Hub from './pages/Hub';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentJoin from './pages/StudentJoin';
import GameResults from './pages/GameResults';
import MultiplayerTest from './pages/MultiplayerTest';

// Games
import MultipleChoice from './components/games/MultipleChoice/MultipleChoice';
import TrueOrFalse from './components/games/TrueOrFalse/TrueOrFalse';
import WordCloud from './components/games/WordCloud/WordCloud';
import PuzzleSequencing from './components/games/PuzzleSequencing/PuzzleSequencing';
import TypeAnswer from './components/games/TypeAnswer/TypeAnswer';
import OpinionPoll from './components/games/OpinionPoll/OpinionPoll';
import RobotRun from './components/games/RobotRun/RobotRun';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main pages */}
        <Route path="/" element={<Hub />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/join" element={<StudentJoin />} />
        <Route path="/results/:sessionId" element={<GameResults />} />
        <Route path="/test" element={<MultiplayerTest />} />

        {/* Game routes */}
        <Route path="/game/multiple-choice/:sessionId" element={<MultipleChoice />} />
        <Route path="/game/true-or-false/:sessionId" element={<TrueOrFalse />} />
        <Route path="/game/word-cloud/:sessionId" element={<WordCloud />} />
        <Route path="/game/puzzle/:sessionId" element={<PuzzleSequencing />} />
        <Route path="/game/type-answer/:sessionId" element={<TypeAnswer />} />
        <Route path="/game/opinion-poll/:sessionId" element={<OpinionPoll />} />
        <Route path="/game/robot-run/:sessionId" element={<RobotRun />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
