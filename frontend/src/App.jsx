import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Matchmaking from './pages/Matchmaking';
import StudyRoom from './pages/StudyRoom';
import QuizBattle from './pages/QuizBattle';
import Result from './pages/Result';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppWrapper />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/profile", element: <Profile /> },
      { 
        element: (
          <main className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8 min-h-screen flex flex-col items-center justify-center">
            <Outlet />
          </main>
        ),
        children: [
          { path: "/home", element: <Home /> },
          { path: "/matchmaking", element: <Matchmaking /> },
          { path: "/study", element: <StudyRoom /> },
          { path: "/battle", element: <QuizBattle /> },
          { path: "/result", element: <Result /> },
          { path: "/leaderboard", element: <Leaderboard /> }
        ]
      }
    ]
  }
]);

function AppWrapper() {
  return (
    <AuthProvider>
      <GameProvider>
        <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary-container selection:text-surface">
          {/* Background Ambient Glows */}
          <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[130px] rounded-full pointer-events-none" />
          <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </GameProvider>
    </AuthProvider>
  );
}

function App() {
  return <RouterProvider router={router} />;
}

export default App;
