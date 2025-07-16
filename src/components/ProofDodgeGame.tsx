import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, RotateCcw, Trophy, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import gameHero from '@/assets/game-hero.jpg';

interface GameObject {
  id: string;
  x: number;
  y: number;
  type: 'error' | 'zkc-token' | 'boost-orb';
  speed: number;
}

const ProofDodgeGame = () => {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'game-over'>('menu');
  const [score, setScore] = useState(0);
  const [uptime, setUptime] = useState(0);
  const [berryPosition, setBerryPosition] = useState(50); // percentage from left
  const [gameObjects, setGameObjects] = useState<GameObject[]>([]);
  const [boostActive, setBoostActive] = useState(false);
  const [bestScore, setBestScore] = useState(() => {
    return parseInt(localStorage.getItem('proof-dodge-best') || '0');
  });
  
  const gameRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const lastSpawnRef = useRef<number>(0);
  const { toast } = useToast();

  const startGame = useCallback(() => {
    setGameState('playing');
    setScore(0);
    setUptime(0);
    setBerryPosition(50);
    setGameObjects([]);
    setBoostActive(false);
    lastSpawnRef.current = Date.now();
  }, []);

  const endGame = useCallback(() => {
    setGameState('game-over');
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem('proof-dodge-best', score.toString());
      toast({
        title: "New High Score! 🏆",
        description: `You achieved ${score} points!`,
      });
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [score, bestScore, toast]);

  const spawnObject = useCallback(() => {
    const now = Date.now();
    if (now - lastSpawnRef.current < (boostActive ? 800 : 1200)) return;
    
    lastSpawnRef.current = now;
    const objectTypes = ['error', 'zkc-token', 'boost-orb'] as const;
    const weights = [0.6, 0.3, 0.1]; // Higher chance for errors
    
    let random = Math.random();
    let selectedType: typeof objectTypes[number] = 'error';
    
    for (let i = 0; i < weights.length; i++) {
      if (random < weights[i]) {
        selectedType = objectTypes[i];
        break;
      }
      random -= weights[i];
    }
    
    const newObject: GameObject = {
      id: `${selectedType}-${now}-${Math.random()}`,
      x: Math.random() * 80 + 10, // 10% to 90% across screen
      y: -50,
      type: selectedType,
      speed: boostActive ? 4 : 2.5,
    };
    
    setGameObjects(prev => [...prev, newObject]);
  }, [boostActive]);

  const checkCollisions = useCallback((objects: GameObject[], berryX: number) => {
    const berryRect = {
      left: berryX - 3,
      right: berryX + 3,
      top: 70,
      bottom: 80,
    };

    return objects.filter(obj => {
      const objRect = {
        left: obj.x - 2,
        right: obj.x + 2,
        top: obj.y,
        bottom: obj.y + 5,
      };

      const collision = berryRect.left < objRect.right &&
                       berryRect.right > objRect.left &&
                       berryRect.top < objRect.bottom &&
                       berryRect.bottom > objRect.top;

      if (collision) {
        if (obj.type === 'error') {
          endGame();
          toast({
            title: "Proof Failed! ❌",
            description: "You hit an error blob. Better luck next time!",
            variant: "destructive",
          });
        } else if (obj.type === 'zkc-token') {
          setScore(prev => prev + 10);
          toast({
            title: "ZKC Token! 💎",
            description: "+10 points",
          });
        } else if (obj.type === 'boost-orb') {
          setScore(prev => prev + 25);
          setBoostActive(true);
          setTimeout(() => setBoostActive(false), 5000);
          toast({
            title: "Boost Activated! ⚡",
            description: "+25 points and speed boost!",
          });
        }
        return false; // Remove collected object
      }
      return true; // Keep object
    });
  }, [endGame, toast]);

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    setUptime(prev => prev + 1);
    spawnObject();

    setGameObjects(prev => {
      const updated = prev
        .map(obj => ({ ...obj, y: obj.y + obj.speed }))
        .filter(obj => obj.y < 100); // Remove objects that fall off screen
      
      return checkCollisions(updated, berryPosition);
    });

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, spawnObject, checkCollisions, berryPosition]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setBerryPosition(prev => Math.max(5, prev - 8));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setBerryPosition(prev => Math.min(95, prev + 8));
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState]);

  // Start game loop
  useEffect(() => {
    if (gameState === 'playing') {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, gameLoop]);

  // Touch controls for mobile
  const handleTouch = (e: React.TouchEvent) => {
    if (gameState !== 'playing') return;
    
    const rect = gameRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const touchX = e.touches[0].clientX - rect.left;
    const newPosition = (touchX / rect.width) * 100;
    setBerryPosition(Math.max(5, Math.min(95, newPosition)));
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div 
          className="w-full max-w-4xl h-96 bg-cover bg-center rounded-xl mb-8 flex items-center justify-center relative overflow-hidden"
          style={{ backgroundImage: `url(${gameHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <div className="relative z-10 text-center">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-electric-blue to-neon-teal bg-clip-text text-transparent">
              🍓 Proof Dodge
            </h1>
            <p className="text-xl text-foreground/80 mb-6 max-w-2xl">
              You're a berry on a mission: dodge those glitchy proofs, collect ZKC orbs, and keep your uptime flawless.
            </p>
          </div>
        </div>
        
        <Card className="p-8 max-w-md w-full bg-card/50 backdrop-blur border-border">
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <p className="text-foreground/80">💥 Collect boosts to speed up your yield</p>
              <p className="text-foreground/80">⚡️ Avoid error blobs or lose your proof score!</p>
            </div>
            
            {bestScore > 0 && (
              <div className="flex items-center justify-center gap-2 text-golden-boost">
                <Trophy className="w-5 h-5" />
                <span>Best: {bestScore} points</span>
              </div>
            )}
            
            <Button 
              onClick={startGame}
              size="lg" 
              className="w-full bg-primary hover:bg-primary/80 text-primary-foreground"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Proving!
            </Button>
            
            <p className="text-sm text-muted-foreground">
              Use ← → arrow keys or A/D to move
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (gameState === 'game-over') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full bg-card/50 backdrop-blur border-border text-center">
          <h2 className="text-3xl font-bold mb-4 text-error-red">Proof Failed!</h2>
          <div className="space-y-4 mb-6">
            <div>
              <p className="text-muted-foreground">Final Score</p>
              <p className="text-2xl font-bold text-primary">{score} points</p>
            </div>
            <div>
              <p className="text-muted-foreground">Proof Uptime</p>
              <p className="text-xl text-neon-teal">{(uptime / 60).toFixed(1)}s</p>
            </div>
            {score === bestScore && score > 0 && (
              <div className="text-golden-boost flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5" />
                <span>New High Score!</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Button onClick={startGame} className="w-full bg-primary hover:bg-primary/80">
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart Proof?
            </Button>
            <Button 
              onClick={() => setGameState('menu')} 
              variant="outline" 
              className="w-full"
            >
              Main Menu
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div 
      ref={gameRef}
      className="min-h-screen bg-gradient-to-b from-cosmic-purple to-background relative overflow-hidden select-none"
      onTouchMove={handleTouch}
      onTouchStart={handleTouch}
    >
      {/* Animated circuit background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--electric-blue))_1px,transparent_1px)] bg-[length:50px_50px] animate-circuit-flow" />
      </div>
      
      {/* UI Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
        <div className="bg-card/80 backdrop-blur rounded-lg px-4 py-2 border border-border">
          <p className="text-sm text-muted-foreground">Proof Uptime</p>
          <p className="text-xl font-mono text-neon-teal">{String(Math.floor(uptime / 60)).padStart(2, '0')}:{String(uptime % 60).padStart(2, '0')}</p>
        </div>
        
        <div className="bg-card/80 backdrop-blur rounded-lg px-4 py-2 border border-border">
          <p className="text-sm text-muted-foreground">Score</p>
          <p className="text-xl font-bold text-primary">{score}</p>
        </div>
        
        {boostActive && (
          <div className="bg-golden-boost/20 backdrop-blur rounded-lg px-4 py-2 border border-golden-boost animate-glow-pulse">
            <div className="flex items-center gap-2 text-golden-boost">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-semibold">BOOST ACTIVE</span>
            </div>
          </div>
        )}
      </div>

      {/* Game Objects */}
      {gameObjects.map(obj => (
        <div
          key={obj.id}
          className={`absolute w-8 h-8 rounded-full transition-all ${
            obj.type === 'error' 
              ? 'bg-gradient-to-br from-error-red to-red-600 shadow-[0_0_15px_hsl(var(--error-red))]' 
              : obj.type === 'zkc-token'
              ? 'bg-gradient-to-br from-electric-blue to-neon-teal shadow-[0_0_15px_hsl(var(--electric-blue))] animate-float'
              : 'bg-gradient-to-br from-golden-boost to-yellow-400 shadow-[0_0_15px_hsl(var(--golden-boost))] animate-glow-pulse'
          }`}
          style={{
            left: `${obj.x}%`,
            top: `${obj.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {obj.type === 'zkc-token' && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
              Z
            </div>
          )}
          {obj.type === 'boost-orb' && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Zap className="w-4 h-4" />
            </div>
          )}
        </div>
      ))}

      {/* Berry Character */}
      <div
        className="absolute w-12 h-12 transition-all duration-100 ease-out"
        style={{
          left: `${berryPosition}%`,
          top: '75%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="w-full h-full bg-gradient-to-br from-red-500 to-pink-600 rounded-full shadow-[0_0_20px_hsl(var(--error-red))] animate-bounce-in relative">
          {/* Berry character details */}
          <div className="absolute top-2 left-3 w-2 h-2 bg-white rounded-full" /> {/* Left eye */}
          <div className="absolute top-2 right-3 w-2 h-2 bg-white rounded-full" /> {/* Right eye */}
          <div className="absolute top-4 left-4 w-1 h-1 bg-black rounded-full" /> {/* Left pupil */}
          <div className="absolute top-4 right-4 w-1 h-1 bg-black rounded-full" /> {/* Right pupil */}
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 text-green-400 text-xs">🌿</div> {/* Leaf */}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
        <p className="text-sm text-muted-foreground">
          Use ← → or A/D to move • Touch to move on mobile
        </p>
      </div>
    </div>
  );
};

export default ProofDodgeGame;