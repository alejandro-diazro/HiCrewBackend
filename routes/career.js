const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticate = require('../middleware/auth');
const airlineConfig = require('../config/airline.config');

// Get current battle pass for authenticated pilot
router.get('/battle-pass/current', authenticate, async (req, res) => {
  try {
    const pilotId = req.user.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get or create current battle pass
    let battlePass = await prisma.battlePass.findFirst({
      where: {
        month: currentMonth,
        year: currentYear,
        isActive: true
      },
      include: {
        challenges: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!battlePass) {
      // Create new battle pass for current month
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
      
      battlePass = await prisma.battlePass.create({
        data: {
          month: currentMonth,
          year: currentYear,
          name: `Battle Pass ${currentMonth}/${currentYear}`,
          startDate,
          endDate,
          challenges: {
            create: [
              {
                type: 'FLIGHTS',
                name: 'Piloto Activo',
                description: 'Completa 5 vuelos este mes',
                icon: 'faPlane',
                targetValue: 5,
                points: 100,
                order: 1
              },
              {
                type: 'HOURS',
                name: 'Navegante Experto',
                description: 'Vuela 10 horas este mes',
                icon: 'faClock',
                targetValue: 10,
                points: 150,
                order: 2
              },
              {
                type: 'AIRPORTS',
                name: 'Explorador',
                description: 'Visita 5 aeropuertos diferentes',
                icon: 'faGlobe',
                targetValue: 5,
                points: 200,
                order: 3
              }
            ]
          }
        },
        include: {
          challenges: {
            orderBy: { order: 'asc' }
          }
        }
      });
    }

    // Get pilot's progress
    const progress = await prisma.pilotBattlePassProgress.findMany({
      where: {
        pilotId,
        battlePassId: battlePass.id
      }
    });

    // Initialize progress if not exists
    if (progress.length === 0 && battlePass.challenges.length > 0) {
      const progressData = battlePass.challenges.map(challenge => ({
        pilotId,
        battlePassId: battlePass.id,
        challengeId: challenge.id,
        currentValue: 0,
        completed: false
      }));

      await prisma.pilotBattlePassProgress.createMany({
        data: progressData
      });

      const newProgress = await prisma.pilotBattlePassProgress.findMany({
        where: {
          pilotId,
          battlePassId: battlePass.id
        }
      });

      progress.push(...newProgress);
    }

    // Calculate completion percentage
    const totalChallenges = battlePass.challenges.length;
    const completedChallenges = progress.filter(p => p.completed).length;
    const completionPercentage = totalChallenges > 0 
      ? Math.round((completedChallenges / totalChallenges) * 100) 
      : 0;

    // Merge challenges with progress
    const challengesWithProgress = battlePass.challenges.map(challenge => {
      const challengeProgress = progress.find(p => p.challengeId === challenge.id);
      return {
        ...challenge,
        currentValue: challengeProgress?.currentValue || 0,
        completed: challengeProgress?.completed || false,
        completedAt: challengeProgress?.completedAt
      };
    });

    res.json({
      battlePass: {
        ...battlePass,
        challenges: challengesWithProgress
      },
      completionPercentage,
      totalPoints: progress.filter(p => p.completed)
        .reduce((sum, p) => {
          const challenge = battlePass.challenges.find(c => c.id === p.challengeId);
          return sum + (challenge?.points || 0);
        }, 0)
    });
  } catch (error) {
    console.error('Error fetching battle pass:', error);
    res.status(500).json({ error: 'Error al obtener el Battle Pass' });
  }
});

// Get pilot's career progress
router.get('/career-progress', authenticate, async (req, res) => {
  try {
    const pilotId = req.user.id;

    // Get pilot stats - IMPORTANT: Include hours field
    const pilot = await prisma.pilot.findUnique({
      where: { id: pilotId },
      include: {
        rank: true,
        careerProgress: {
          include: {
            milestone: true
          }
        }
      }
    });

    if (!pilot) {
      return res.status(404).json({ error: 'Piloto no encontrado' });
    }

    // Get all career milestones
    const milestones = await prisma.careerMilestone.findMany({
      orderBy: [
        { type: 'asc' },
        { level: 'asc' }
      ]
    });

    // Initialize or get stats using upsert
    await prisma.pilotStats.upsert({
      where: { pilotId },
      update: {
        totalHours: pilot.hours || 0
      },
      create: {
        pilotId,
        totalFlights: 0,
        totalHours: pilot.hours || 0
      }
    });

    // Calculate next milestones
    const nextHoursMilestone = milestones.find(m => 
      m.type === 'HOURS' && 
      m.requiredHours && 
      m.requiredHours > (pilot.hours || 0)
    );

    const totalFlights = await prisma.flight.count({
      where: {
        pilotId,
        status: 2 // Accepted
      }
    });

    const nextFlightsMilestone = milestones.find(m => 
      m.type === 'FLIGHTS' && 
      m.requiredFlights && 
      m.requiredFlights > totalFlights
    );

    // Get unlocked milestones
    const unlockedMilestones = pilot.careerProgress.map(cp => cp.milestone);

    // Get all ranks to determine current rank level
    const allRanks = await prisma.rank.findMany({
      orderBy: { hours: 'asc' }
    });
    
    const currentRankLevel = allRanks.findIndex(r => r.id === pilot.rank?.id) + 1;

    // Get pilot stats if exists
    const pilotStats = await prisma.pilotStats.findUnique({
      where: { pilotId }
    });

    res.json({
      currentRank: {
        ...pilot.rank,
        level: currentRankLevel // Nivel 1-7 para los galones CSS
      },
      stats: {
        totalHours: pilot.hours || 0,
        totalFlights,
        gamificationPoints: pilotStats?.gamificationPoints || 0
      },
      nextMilestones: {
        hours: nextHoursMilestone ? {
          ...nextHoursMilestone,
          currentValue: pilot.hours || 0,
          progress: nextHoursMilestone.requiredHours 
            ? Math.round(((pilot.hours || 0) / nextHoursMilestone.requiredHours) * 100)
            : 0
        } : null,
        flights: nextFlightsMilestone ? {
          ...nextFlightsMilestone,
          currentValue: totalFlights,
          progress: nextFlightsMilestone.requiredFlights
            ? Math.round((totalFlights / nextFlightsMilestone.requiredFlights) * 100)
            : 0
        } : null
      },
      unlockedMilestones,
      availableMilestones: milestones
    });
  } catch (error) {
    console.error('Error fetching career progress:', error);
    res.status(500).json({ error: 'Error al obtener el progreso de carrera' });
  }
});

// Get pilot achievements
router.get('/achievements', authenticate, async (req, res) => {
  try {
    const pilotId = req.user.id;

    // Get all achievements
    const achievements = await prisma.achievement.findMany({
      orderBy: [
        { category: 'asc' },
        { rarity: 'desc' }
      ]
    });

    // Get pilot's unlocked achievements
    const unlockedAchievements = await prisma.pilotAchievement.findMany({
      where: { pilotId },
      include: {
        achievement: true
      }
    });

    const unlockedIds = unlockedAchievements.map(ua => ua.achievementId);

    // Categorize achievements
    const categorizedAchievements = {};
    achievements.forEach(achievement => {
      if (!categorizedAchievements[achievement.category]) {
        categorizedAchievements[achievement.category] = [];
      }
      categorizedAchievements[achievement.category].push({
        ...achievement,
        unlocked: unlockedIds.includes(achievement.id),
        unlockedAt: unlockedAchievements.find(ua => ua.achievementId === achievement.id)?.unlockedAt
      });
    });

    res.json({
      totalAchievements: achievements.length,
      unlockedCount: unlockedAchievements.length,
      completionPercentage: Math.round((unlockedAchievements.length / achievements.length) * 100),
      categories: categorizedAchievements,
      recentUnlocks: unlockedAchievements
        .sort((a, b) => b.unlockedAt - a.unlockedAt)
        .slice(0, 5)
        .map(ua => ua.achievement)
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Error al obtener los logros' });
  }
});

// Get pilot monthly rewards
router.get('/monthly-rewards', authenticate, async (req, res) => {
  try {
    const pilotId = req.user.id;

    const rewards = await prisma.pilotMonthlyReward.findMany({
      where: { pilotId },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    res.json(rewards);
  } catch (error) {
    console.error('Error fetching monthly rewards:', error);
    res.status(500).json({ error: 'Error al obtener las recompensas mensuales' });
  }
});

// Update progress after flight (called internally)
router.post('/update-flight-progress', authenticate, async (req, res) => {
  try {
    const { flightId } = req.body;
    const pilotId = req.user.id;

    // Get flight details
    const flight = await prisma.flight.findUnique({
      where: { id: flightId },
      include: {
        departure: true,
        arrival: true
      }
    });

    if (!flight || flight.pilotId !== pilotId) {
      return res.status(403).json({ error: 'Vuelo no autorizado' });
    }

    // Calculate flight duration in hours
    const duration = flight.startFlight && flight.closeFlight
      ? (flight.closeFlight - flight.startFlight) / (1000 * 60 * 60)
      : 0;

    // Update pilot stats
    const stats = await prisma.pilotStats.upsert({
      where: { pilotId },
      update: {
        totalFlights: { increment: 1 },
        totalHours: { increment: duration },
        monthlyFlights: { increment: 1 },
        monthlyHours: { increment: duration },
        lastFlightDate: new Date()
      },
      create: {
        pilotId,
        totalFlights: 1,
        totalHours: duration,
        monthlyFlights: 1,
        monthlyHours: duration,
        lastFlightDate: new Date()
      }
    });

    // Update battle pass progress
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const battlePass = await prisma.battlePass.findFirst({
      where: {
        month: currentMonth,
        year: currentYear,
        isActive: true
      },
      include: {
        challenges: true
      }
    });

    if (battlePass) {
      // Update FLIGHTS challenge
      const flightChallenge = battlePass.challenges.find(c => c.type === 'FLIGHTS');
      if (flightChallenge) {
        await prisma.pilotBattlePassProgress.upsert({
          where: {
            pilotId_battlePassId_challengeId: {
              pilotId,
              battlePassId: battlePass.id,
              challengeId: flightChallenge.id
            }
          },
          update: {
            currentValue: { increment: 1 }
          },
          create: {
            pilotId,
            battlePassId: battlePass.id,
            challengeId: flightChallenge.id,
            currentValue: 1
          }
        });

        // Check if completed
        const progress = await prisma.pilotBattlePassProgress.findUnique({
          where: {
            pilotId_battlePassId_challengeId: {
              pilotId,
              battlePassId: battlePass.id,
              challengeId: flightChallenge.id
            }
          }
        });

        if (progress && progress.currentValue >= flightChallenge.targetValue && !progress.completed) {
          await prisma.pilotBattlePassProgress.update({
            where: { id: progress.id },
            data: {
              completed: true,
              completedAt: new Date()
            }
          });
        }
      }

      // Update HOURS challenge
      const hoursChallenge = battlePass.challenges.find(c => c.type === 'HOURS');
      if (hoursChallenge) {
        const currentProgress = await prisma.pilotBattlePassProgress.findUnique({
          where: {
            pilotId_battlePassId_challengeId: {
              pilotId,
              battlePassId: battlePass.id,
              challengeId: hoursChallenge.id
            }
          }
        });

        const newHoursValue = (currentProgress?.currentValue || 0) + Math.floor(duration);

        await prisma.pilotBattlePassProgress.upsert({
          where: {
            pilotId_battlePassId_challengeId: {
              pilotId,
              battlePassId: battlePass.id,
              challengeId: hoursChallenge.id
            }
          },
          update: {
            currentValue: newHoursValue,
            completed: newHoursValue >= hoursChallenge.targetValue,
            completedAt: newHoursValue >= hoursChallenge.targetValue ? new Date() : undefined
          },
          create: {
            pilotId,
            battlePassId: battlePass.id,
            challengeId: hoursChallenge.id,
            currentValue: Math.floor(duration)
          }
        });
      }
    }

    // Check for career milestones
    const totalFlights = stats.totalFlights;
    const totalHours = stats.totalHours;

    const milestones = await prisma.careerMilestone.findMany({
      where: {
        OR: [
          {
            type: 'HOURS',
            requiredHours: { lte: totalHours }
          },
          {
            type: 'FLIGHTS',
            requiredFlights: { lte: totalFlights }
          }
        ]
      }
    });

    // Unlock new milestones
    for (const milestone of milestones) {
      await prisma.pilotCareerProgress.upsert({
        where: {
          pilotId_milestoneId: {
            pilotId,
            milestoneId: milestone.id
          }
        },
        update: {},
        create: {
          pilotId,
          milestoneId: milestone.id
        }
      });
    }

    res.json({ 
      message: 'Progreso actualizado',
      stats,
      newMilestones: milestones.length
    });
  } catch (error) {
    console.error('Error updating flight progress:', error);
    res.status(500).json({ error: 'Error al actualizar el progreso' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'monthly', limit = 10 } = req.query;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    let leaderboard;

    if (type === 'monthly') {
      // Monthly leaderboard based on current month flights
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      const pilots = await prisma.pilot.findMany({
        where: {
          flights: {
            some: {
              status: 2,
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          }
        },
        select: {
          id: true,
          firstName: true,
          callsign: true,
          rank: {
            select: {
              name: true,
              img: true
            }
          },
          flights: {
            where: {
              status: 2,
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            },
            select: {
              id: true
            }
          },
          stats: {
            select: {
              monthlyFlights: true,
              monthlyHours: true,
              gamificationPoints: true
            }
          }
        }
      });

      leaderboard = pilots
        .map(pilot => ({
          ...pilot,
          monthlyFlights: pilot.flights.length,
          monthlyHours: pilot.stats?.monthlyHours || 0,
          points: pilot.stats?.gamificationPoints || 0
        }))
        .sort((a, b) => b.monthlyFlights - a.monthlyFlights)
        .slice(0, parseInt(limit));
    } else {
      // All-time leaderboard
      const pilots = await prisma.pilot.findMany({
        include: {
          rank: {
            select: {
              name: true,
              img: true
            }
          },
          stats: {
            select: {
              totalFlights: true,
              totalHours: true,
              gamificationPoints: true
            }
          }
        },
        orderBy: {
          hours: 'desc'
        },
        take: parseInt(limit)
      });

      leaderboard = pilots.map(pilot => ({
        id: pilot.id,
        firstName: pilot.firstName,
        callsign: pilot.callsign,
        rank: pilot.rank,
        totalFlights: pilot.stats?.totalFlights || 0,
        totalHours: pilot.hours || 0,
        points: pilot.stats?.gamificationPoints || 0
      }));
    }

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Error al obtener el ranking' });
  }
});

// Initialize career milestones (run once)
router.post('/init-milestones', async (req, res) => {
  try {
    // Check if milestones already exist
    const existingCount = await prisma.careerMilestone.count();
    if (existingCount > 0) {
      return res.json({ message: 'Los hitos ya están inicializados' });
    }

    // Create default milestones
    const milestones = [
      // Hours milestones
      { type: 'HOURS', name: 'Primer Vuelo', description: 'Completa tu primera hora de vuelo', requiredHours: 1, level: 1, points: 50 },
      { type: 'HOURS', name: 'Piloto Novato', description: 'Alcanza 10 horas de vuelo', requiredHours: 10, level: 2, points: 100 },
      { type: 'HOURS', name: 'Piloto Junior', description: 'Alcanza 50 horas de vuelo', requiredHours: 50, level: 3, points: 200 },
      { type: 'HOURS', name: 'Piloto Senior', description: 'Alcanza 100 horas de vuelo', requiredHours: 100, level: 4, points: 300 },
      { type: 'HOURS', name: 'Comandante', description: 'Alcanza 250 horas de vuelo', requiredHours: 250, level: 5, points: 500 },
      { type: 'HOURS', name: 'Capitán Experto', description: 'Alcanza 500 horas de vuelo', requiredHours: 500, level: 6, points: 750 },
      { type: 'HOURS', name: 'Veterano', description: 'Alcanza 1000 horas de vuelo', requiredHours: 1000, level: 7, points: 1000 },
      
      // Flights milestones
      { type: 'FLIGHTS', name: 'Despegue Inicial', description: 'Completa tu primer vuelo', requiredFlights: 1, level: 1, points: 50 },
      { type: 'FLIGHTS', name: 'Piloto Frecuente', description: 'Completa 10 vuelos', requiredFlights: 10, level: 2, points: 100 },
      { type: 'FLIGHTS', name: 'Navegante', description: 'Completa 25 vuelos', requiredFlights: 25, level: 3, points: 200 },
      { type: 'FLIGHTS', name: 'Piloto Dedicado', description: 'Completa 50 vuelos', requiredFlights: 50, level: 4, points: 300 },
      { type: 'FLIGHTS', name: 'Experto en Rutas', description: 'Completa 100 vuelos', requiredFlights: 100, level: 5, points: 500 },
      { type: 'FLIGHTS', name: 'Maestro del Aire', description: 'Completa 250 vuelos', requiredFlights: 250, level: 6, points: 750 },
      { type: 'FLIGHTS', name: 'Leyenda', description: 'Completa 500 vuelos', requiredFlights: 500, level: 7, points: 1000 }
    ];

    await prisma.careerMilestone.createMany({
      data: milestones
    });

    // Create default achievements
    const achievements = [
      // Special achievements
      { category: 'SPECIAL', name: 'Piloto del Mes', description: 'Ser nombrado piloto del mes', rarity: 'legendary', points: 500 },
      { category: 'SPECIAL', name: 'Battle Pass Maestro', description: 'Completa todos los desafíos del Battle Pass', rarity: 'epic', points: 300 },
      { category: 'SPECIAL', name: 'Primera Conexión', description: `Únete a ${airlineConfig.email.name}`, rarity: 'common', points: 25 },
      
      // Landing achievements
      { category: 'LANDING', name: 'Toque Suave', description: 'Aterriza con menos de -150 fpm', rarity: 'common', points: 50 },
      { category: 'LANDING', name: 'Mantequilla', description: 'Aterriza con menos de -100 fpm', rarity: 'rare', points: 100 },
      { category: 'LANDING', name: 'Perfección', description: 'Aterriza con menos de -50 fpm', rarity: 'epic', points: 200 },
      
      // Exploration achievements
      { category: 'EXPLORATION', name: 'Viajero', description: 'Visita 10 aeropuertos diferentes', rarity: 'common', points: 75 },
      { category: 'EXPLORATION', name: 'Explorador Global', description: 'Visita 50 aeropuertos diferentes', rarity: 'rare', points: 150 },
      { category: 'EXPLORATION', name: 'Ciudadano del Mundo', description: 'Visita 100 aeropuertos diferentes', rarity: 'epic', points: 300 },
      
      // Monthly achievements
      { category: 'MONTHLY', name: 'Constancia', description: 'Vuela al menos una vez cada semana del mes', rarity: 'rare', points: 150 },
      { category: 'MONTHLY', name: 'Dedicación', description: 'Completa 20 vuelos en un mes', rarity: 'epic', points: 250 },
      { category: 'MONTHLY', name: 'Sin Descanso', description: 'Vuela todos los días durante una semana', rarity: 'legendary', points: 400 }
    ];

    await prisma.achievement.createMany({
      data: achievements
    });

    res.json({ 
      message: 'Sistema de gamificación inicializado',
      milestones: milestones.length,
      achievements: achievements.length
    });
  } catch (error) {
    console.error('Error initializing milestones:', error);
    res.status(500).json({ error: 'Error al inicializar los hitos' });
  }
});

module.exports = router;