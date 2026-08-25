const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticate = require('../middleware/auth');
const checkPermissions = require('../middleware/permissions');

// ====================================
// GESTIÓN DE BATTLE PASS
// ====================================

// Obtener Battle Pass actual con desafíos
router.get('/battle-pass/current', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const currentBattlePass = await prisma.battlePass.findFirst({
      where: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        challenges: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json(currentBattlePass || { message: 'No hay Battle Pass activo' });
  } catch (error) {
    console.error('Error fetching current battle pass:', error);
    res.status(500).json({ error: 'Error al obtener Battle Pass actual' });
  }
});

// Obtener todos los Battle Pass
router.get('/battle-pass', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const battlePasses = await prisma.battlePass.findMany({
      include: {
        challenges: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    res.json(battlePasses);
  } catch (error) {
    console.error('Error fetching battle passes:', error);
    res.status(500).json({ error: 'Error al obtener Battle Passes' });
  }
});

// Actualizar desafío de Battle Pass
router.put('/battle-pass/challenge/:id', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, targetValue, points, icon } = req.body;

    const updatedChallenge = await prisma.battlePassChallenge.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        targetValue,
        points,
        icon
      }
    });

    res.json(updatedChallenge);
  } catch (error) {
    console.error('Error updating challenge:', error);
    res.status(500).json({ error: 'Error al actualizar desafío' });
  }
});

// Eliminar desafío de Battle Pass
router.delete('/battle-pass/challenge/:id', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Eliminar el progreso de los pilotos cuando la tabla PilotChallenge exista
    // await prisma.pilotChallenge.deleteMany({
    //   where: { challengeId: parseInt(id) }
    // });

    await prisma.battlePassChallenge.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Desafío eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting challenge:', error);
    res.status(500).json({ error: 'Error al eliminar desafío' });
  }
});

// ====================================
// GESTIÓN DE MILESTONES (HITOS)
// ====================================

router.get('/milestones', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const milestones = await prisma.careerMilestone.findMany({
      orderBy: [
        { type: 'asc' },
        { requiredHours: 'asc' },
        { requiredFlights: 'asc' }
      ]
    });

    res.json(milestones);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ error: 'Error al obtener hitos' });
  }
});

router.post('/milestones', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { type, name, description, requiredHours, requiredFlights, points, level } = req.body;

    const milestone = await prisma.careerMilestone.create({
      data: {
        type,
        name,
        description,
        requiredHours,
        requiredFlights,
        points,
        level
      }
    });

    res.json(milestone);
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: 'Error al crear hito' });
  }
});

router.put('/milestones/:id', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, requiredHours, requiredFlights, points, level } = req.body;

    const milestone = await prisma.careerMilestone.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        requiredHours,
        requiredFlights,
        points,
        level
      }
    });

    res.json(milestone);
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: 'Error al actualizar hito' });
  }
});

router.delete('/milestones/:id', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Eliminar progreso de pilotos cuando la tabla PilotMilestone exista
    // await prisma.pilotMilestone.deleteMany({
    //   where: { milestoneId: parseInt(id) }
    // });

    // Eliminar milestone
    await prisma.careerMilestone.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Hito eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: 'Error al eliminar hito' });
  }
});

// ====================================
// GESTIÓN DE ACHIEVEMENTS (LOGROS)
// ====================================

router.get('/achievements', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const achievements = await prisma.achievement.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json(achievements);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Error al obtener logros' });
  }
});

router.post('/achievements', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { category, name, description, rarity, points, isSecret, icon } = req.body;

    const achievement = await prisma.achievement.create({
      data: {
        category,
        name,
        description,
        rarity,
        points,
        isSecret,
        icon
      }
    });

    res.json(achievement);
  } catch (error) {
    console.error('Error creating achievement:', error);
    res.status(500).json({ error: 'Error al crear logro' });
  }
});

router.put('/achievements/:id', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, rarity, points, isSecret, icon } = req.body;

    const achievement = await prisma.achievement.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        category,
        rarity,
        points,
        isSecret,
        icon
      }
    });

    res.json(achievement);
  } catch (error) {
    console.error('Error updating achievement:', error);
    res.status(500).json({ error: 'Error al actualizar logro' });
  }
});

router.delete('/achievements/:id', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminar progreso de pilotos
    await prisma.pilotAchievement.deleteMany({
      where: { achievementId: parseInt(id) }
    });

    // Eliminar achievement
    await prisma.achievement.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Logro eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting achievement:', error);
    res.status(500).json({ error: 'Error al eliminar logro' });
  }
});

// ====================================
// ESTADÍSTICAS Y PROGRESO
// ====================================

// Obtener estadísticas generales del sistema Career
router.get('/stats', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const [
      totalPilots,
      activePilots,
      totalMilestones,
      totalAchievements,
      avgPoints
    ] = await Promise.all([
      prisma.pilot.count(),
      prisma.pilotStats.count({
        where: {
          lastFlightDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
          }
        }
      }),
      prisma.careerMilestone.count(),
      prisma.achievement.count(),
      prisma.pilotStats.aggregate({
        _avg: {
          gamificationPoints: true
        }
      })
    ]);

    res.json({
      totalPilots,
      activePilots,
      totalMilestones,
      totalAchievements,
      averagePoints: Math.round(avgPoints._avg.gamificationPoints || 0)
    });
  } catch (error) {
    console.error('Error fetching career stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Resetear progreso de un piloto
router.post('/reset-pilot/:pilotId', authenticate, checkPermissions(['ADMIN']), async (req, res) => {
  try {
    const { pilotId } = req.params;
    const pilotIdInt = parseInt(pilotId);

    await prisma.$transaction([
      // Eliminar progreso de Battle Pass
      prisma.pilotBattlePassProgress.deleteMany({
        where: { pilotId: pilotIdInt }
      }),
      // TODO: Eliminar PilotChallenge cuando la tabla exista
      // prisma.pilotChallenge.deleteMany({
      //   where: { pilotId: pilotIdInt }
      // }),
      // TODO: Eliminar milestones cuando la tabla PilotMilestone exista
      // prisma.pilotMilestone.deleteMany({
      //   where: { pilotId: pilotIdInt }
      // }),
      // Eliminar achievements
      prisma.pilotAchievement.deleteMany({
        where: { pilotId: pilotIdInt }
      }),
      // Resetear estadísticas
      prisma.pilotStats.update({
        where: { pilotId: pilotIdInt },
        data: {
          gamificationPoints: 0,
          perfectLandings: 0
        }
      })
    ]);

    res.json({ message: 'Progreso del piloto reseteado correctamente' });
  } catch (error) {
    console.error('Error resetting pilot progress:', error);
    res.status(500).json({ error: 'Error al resetear progreso del piloto' });
  }
});

module.exports = router;