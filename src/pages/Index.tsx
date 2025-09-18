import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { toast } from '@/components/ui/use-toast';

interface User {
  id: number;
  username: string;
  is_admin: boolean;
}

interface Character {
  id: number;
  name: string;
  description: string;
  image_url: string;
  is_limited: boolean;
  limited_until?: string;
  rarity: {
    name: string;
    color: string;
    chance: number;
  };
}

interface Rarity {
  id: number;
  name: string;
  color: string;
  chance: number;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Auth form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Game state
  const [spinCooldown, setSpinCooldown] = useState<number>(0);
  const [lastCharacter, setLastCharacter] = useState<Character | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  
  // Admin state
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  
  // Character creation form
  const [newCharacter, setNewCharacter] = useState({
    name: '',
    description: '',
    image_url: '',
    rarity_id: '',
    is_limited: false,
    limited_until: ''
  });
  
  // Rarity creation form
  const [newRarity, setNewRarity] = useState({
    name: '',
    color: '#9CA3AF',
    chance: ''
  });

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('rng_token');
    const savedUser = localStorage.getItem('rng_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Load admin data when user is admin
  useEffect(() => {
    if (user?.is_admin && token) {
      loadAdminData();
    }
  }, [user, token]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast({ title: 'Ошибка', description: 'Заполните все поля', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/18b6553c-5875-4e43-93ac-6e9ec7ff4713', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: authMode,
          username: username.trim(),
          password: password
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('rng_token', data.token);
        localStorage.setItem('rng_user', JSON.stringify(data.user));
        toast({ 
          title: 'Успешно!', 
          description: authMode === 'login' ? 'Добро пожаловать!' : 'Регистрация завершена!',
          variant: 'default'
        });
        setUsername('');
        setPassword('');
      } else {
        toast({ title: 'Ошибка', description: data.error || 'Что-то пошло не так', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Проблема с подключением', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('rng_token');
    localStorage.removeItem('rng_user');
    toast({ title: 'Выход', description: 'До свидания!', variant: 'default' });
  };

  const handleSpin = async () => {
    if (!token || spinCooldown > 0) return;

    setIsSpinning(true);
    try {
      const response = await fetch('https://functions.poehali.dev/c13e7961-0f08-43e6-bf4a-5a06ab34c3f4', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setLastCharacter(data.character);
        const nextSpin = new Date(data.next_spin_available);
        const now = new Date();
        const cooldownTime = Math.max(0, Math.floor((nextSpin.getTime() - now.getTime()) / 1000));
        setSpinCooldown(cooldownTime);
        
        toast({ 
          title: `Получен персонаж: ${data.character.name}!`,
          description: `Редкость: ${data.character.rarity.name}`,
          variant: 'default'
        });
      } else {
        if (response.status === 429) {
          setSpinCooldown(data.remaining_minutes * 60);
        }
        toast({ title: 'Ошибка', description: data.error || 'Не удалось выполнить крутку', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Проблема с подключением', variant: 'destructive' });
    }
    setIsSpinning(false);
  };

  const loadAdminData = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/1a6f3c0e-a502-475b-ab42-56dc3da305e1', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCharacters(data.characters || []);
        setRarities(data.rarities || []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  const createCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharacter.name.trim() || !newCharacter.rarity_id) {
      toast({ title: 'Ошибка', description: 'Заполните обязательные поля', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/1a6f3c0e-a502-475b-ab42-56dc3da305e1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create_character',
          ...newCharacter,
          rarity_id: parseInt(newCharacter.rarity_id)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({ title: 'Успешно!', description: data.message, variant: 'default' });
        setNewCharacter({
          name: '',
          description: '',
          image_url: '',
          rarity_id: '',
          is_limited: false,
          limited_until: ''
        });
        loadAdminData();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Проблема с подключением', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const createRarity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRarity.name.trim() || !newRarity.chance) {
      toast({ title: 'Ошибка', description: 'Заполните все поля', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/1a6f3c0e-a502-475b-ab42-56dc3da305e1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create_rarity',
          ...newRarity,
          chance: parseFloat(newRarity.chance)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({ title: 'Успешно!', description: data.message, variant: 'default' });
        setNewRarity({ name: '', color: '#9CA3AF', chance: '' });
        loadAdminData();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Проблема с подключением', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  // Countdown timer for spin cooldown
  useEffect(() => {
    if (spinCooldown > 0) {
      const timer = setInterval(() => {
        setSpinCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [spinCooldown]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getRarityClass = (rarityName: string) => {
    const name = rarityName.toLowerCase();
    if (name.includes('common')) return 'rarity-common';
    if (name.includes('rare')) return 'rarity-rare';
    if (name.includes('epic')) return 'rarity-epic';
    if (name.includes('legendary')) return 'rarity-legendary';
    if (name.includes('mythical')) return 'rarity-mythical';
    if (name.includes('divine')) return 'rarity-divine';
    return 'rarity-common';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/20 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Icon name="Zap" className="h-8 w-8 text-primary animate-pulse" />
                <h1 className="game-title text-2xl text-primary">RNG LEGENDS</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Icon name="User" className="h-4 w-4" />
                    <span className="font-medium">{user.username}</span>
                    {user.is_admin && (
                      <Badge variant="outline" className="text-accent border-accent">Admin</Badge>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleLogout} size="sm">
                    <Icon name="LogOut" className="h-4 w-4 mr-2" />
                    Выход
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Войдите для игры
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!user ? (
          /* Authentication */
          <div className="max-w-md mx-auto animate-fade-in">
            <Card className="bg-card/80 backdrop-blur-sm border border-border/50 shadow-xl">
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Icon name="Gamepad2" className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <CardTitle className="game-title text-2xl">Добро пожаловать в RNG LEGENDS</CardTitle>
                <CardDescription>
                  Соберите коллекцию уникальных персонажей разных редкостей
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'register')}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Вход</TabsTrigger>
                    <TabsTrigger value="register">Регистрация</TabsTrigger>
                  </TabsList>
                  
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Имя пользователя</Label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Введите имя пользователя"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Пароль</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Введите пароль"
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full spin-button-ready"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Icon name="Loader2" className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Icon name="LogIn" className="h-4 w-4 mr-2" />
                      )}
                      {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                    </Button>
                  </form>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Main Game Interface */
          <div className="space-y-8">
            {/* Spin Section */}
            <div className="text-center animate-fade-in">
              <Card className="max-w-2xl mx-auto bg-gradient-to-br from-card/50 to-card/80 backdrop-blur-md border border-border/50 shadow-xl">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className={`p-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 ${isSpinning ? 'animate-spin-glow' : ''}`}>
                      <Icon name="Sparkles" className="h-16 w-16 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="game-title text-3xl">Крутка персонажей</CardTitle>
                  <CardDescription className="text-lg">
                    Получите случайного персонажа и расширьте свою коллекцию
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {lastCharacter && (
                    <div className="character-card animate-scale-in">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          {lastCharacter.image_url ? (
                            <img 
                              src={lastCharacter.image_url} 
                              alt={lastCharacter.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Icon name="User" className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{lastCharacter.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{lastCharacter.description}</p>
                          <Badge 
                            className={getRarityClass(lastCharacter.rarity.name)}
                            style={{ borderColor: lastCharacter.rarity.color }}
                          >
                            {lastCharacter.rarity.name}
                          </Badge>
                          {lastCharacter.is_limited && (
                            <Badge variant="outline" className="ml-2 text-accent border-accent">
                              Limited
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <Button
                      onClick={handleSpin}
                      disabled={spinCooldown > 0 || isSpinning}
                      className={`w-full h-12 text-lg font-semibold ${
                        spinCooldown > 0 || isSpinning 
                          ? 'spin-button-cooldown' 
                          : 'spin-button-ready'
                      }`}
                    >
                      {isSpinning ? (
                        <>
                          <Icon name="Loader2" className="h-5 w-5 mr-2 animate-spin" />
                          Крутим...
                        </>
                      ) : spinCooldown > 0 ? (
                        <>
                          <Icon name="Clock" className="h-5 w-5 mr-2" />
                          Кулдаун: {formatTime(spinCooldown)}
                        </>
                      ) : (
                        <>
                          <Icon name="Zap" className="h-5 w-5 mr-2" />
                          Крутить персонажа
                        </>
                      )}
                    </Button>
                    
                    {spinCooldown > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Следующая крутка через:</span>
                          <span>{formatTime(spinCooldown)}</span>
                        </div>
                        <Progress 
                          value={((3600 - spinCooldown) / 3600) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Admin Panel */}
            {user.is_admin && (
              <div className="animate-fade-in">
                <Card className="admin-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Icon name="Settings" className="h-6 w-6 text-accent" />
                      <span>Админ-панель</span>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent>
                    <Tabs defaultValue="characters" className="space-y-6">
                      <TabsList>
                        <TabsTrigger value="characters">Персонажи</TabsTrigger>
                        <TabsTrigger value="rarities">Редкости</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="characters" className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* Create Character Form */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Создать персонажа</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <form onSubmit={createCharacter} className="space-y-4">
                                <div>
                                  <Label htmlFor="char-name">Имя *</Label>
                                  <Input
                                    id="char-name"
                                    value={newCharacter.name}
                                    onChange={(e) => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Введите имя персонажа"
                                    required
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor="char-desc">Описание</Label>
                                  <Textarea
                                    id="char-desc"
                                    value={newCharacter.description}
                                    onChange={(e) => setNewCharacter(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Описание персонажа"
                                    rows={3}
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor="char-image">URL изображения</Label>
                                  <Input
                                    id="char-image"
                                    value={newCharacter.image_url}
                                    onChange={(e) => setNewCharacter(prev => ({ ...prev, image_url: e.target.value }))}
                                    placeholder="https://example.com/image.jpg"
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor="char-rarity">Редкость *</Label>
                                  <Select 
                                    value={newCharacter.rarity_id} 
                                    onValueChange={(value) => setNewCharacter(prev => ({ ...prev, rarity_id: value }))}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Выберите редкость" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {rarities.map(rarity => (
                                        <SelectItem key={rarity.id} value={rarity.id.toString()}>
                                          <div className="flex items-center space-x-2">
                                            <div 
                                              className="w-3 h-3 rounded-full" 
                                              style={{ backgroundColor: rarity.color }}
                                            />
                                            <span>{rarity.name} ({(rarity.chance * 100).toFixed(2)}%)</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="space-y-4">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="char-limited"
                                      checked={newCharacter.is_limited}
                                      onChange={(e) => setNewCharacter(prev => ({ ...prev, is_limited: e.target.checked }))}
                                      className="rounded"
                                    />
                                    <Label htmlFor="char-limited">Лимитированный персонаж</Label>
                                  </div>
                                  
                                  {newCharacter.is_limited && (
                                    <div>
                                      <Label htmlFor="char-until">Доступен до</Label>
                                      <Input
                                        id="char-until"
                                        type="datetime-local"
                                        value={newCharacter.limited_until}
                                        onChange={(e) => setNewCharacter(prev => ({ ...prev, limited_until: e.target.value }))}
                                      />
                                    </div>
                                  )}
                                </div>
                                
                                <Button type="submit" disabled={isLoading} className="w-full">
                                  {isLoading ? (
                                    <Icon name="Loader2" className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Icon name="Plus" className="h-4 w-4 mr-2" />
                                  )}
                                  Создать персонажа
                                </Button>
                              </form>
                            </CardContent>
                          </Card>
                          
                          {/* Characters List */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Созданные персонажи ({characters.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4 max-h-96 overflow-y-auto">
                                {characters.length === 0 ? (
                                  <div className="text-center text-muted-foreground py-8">
                                    <Icon name="Ghost" className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>Персонажи ещё не созданы</p>
                                    <p className="text-sm">Создайте первого персонажа!</p>
                                  </div>
                                ) : (
                                  characters.map(character => (
                                    <div key={character.id} className="character-card">
                                      <div className="flex items-start space-x-3">
                                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                                          {character.image_url ? (
                                            <img 
                                              src={character.image_url} 
                                              alt={character.name}
                                              className="w-full h-full object-cover rounded-lg"
                                            />
                                          ) : (
                                            <Icon name="User" className="h-6 w-6 text-muted-foreground" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-medium truncate">{character.name}</h4>
                                          {character.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                              {character.description}
                                            </p>
                                          )}
                                          <div className="flex items-center space-x-2 mt-2">
                                            <Badge 
                                              className={getRarityClass(character.rarity.name)}
                                              style={{ borderColor: character.rarity.color }}
                                            >
                                              {character.rarity.name}
                                            </Badge>
                                            {character.is_limited && (
                                              <Badge variant="outline" className="text-accent border-accent">
                                                Limited
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="rarities" className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* Create Rarity Form */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Создать редкость</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <form onSubmit={createRarity} className="space-y-4">
                                <div>
                                  <Label htmlFor="rarity-name">Название *</Label>
                                  <Input
                                    id="rarity-name"
                                    value={newRarity.name}
                                    onChange={(e) => setNewRarity(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Например: Ultra Rare"
                                    required
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor="rarity-color">Цвет *</Label>
                                  <Input
                                    id="rarity-color"
                                    type="color"
                                    value={newRarity.color}
                                    onChange={(e) => setNewRarity(prev => ({ ...prev, color: e.target.value }))}
                                    className="h-12"
                                    required
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor="rarity-chance">Шанс выпадения (0.0001 - 1.0) *</Label>
                                  <Input
                                    id="rarity-chance"
                                    type="number"
                                    step="0.0001"
                                    min="0.0001"
                                    max="1"
                                    value={newRarity.chance}
                                    onChange={(e) => setNewRarity(prev => ({ ...prev, chance: e.target.value }))}
                                    placeholder="0.05"
                                    required
                                  />
                                </div>
                                
                                <Button type="submit" disabled={isLoading} className="w-full">
                                  {isLoading ? (
                                    <Icon name="Loader2" className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Icon name="Palette" className="h-4 w-4 mr-2" />
                                  )}
                                  Создать редкость
                                </Button>
                              </form>
                            </CardContent>
                          </Card>
                          
                          {/* Rarities List */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Существующие редкости ({rarities.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {rarities.map(rarity => (
                                  <div key={rarity.id} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                                    <div 
                                      className="w-4 h-4 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: rarity.color }}
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium">{rarity.name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        Шанс: {(rarity.chance * 100).toFixed(2)}%
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;