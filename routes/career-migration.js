const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/calculate-historical', async (req, res) => {
  try {
    console.log('Iniciando cálculo histórico de progreso...');
    
    // Obtener todos los pilotos
    const pilots = await prisma.pilot.findMany({
      include: {
        flights: {
          where: {
            status: 2 // Solo vuelos aceptados
          }
        }
      }
    });

    console.log(`Procesando ${pilots.length} pilotos...`);
    
    let processedCount = 0;
    let errors = [];

    for (const pilot of pilots) {
      try {
        // Inicializar o actualizar PilotStats
        const totalFlights = pilot.flights.length;
        const totalHours = pilot.hours || 0;
        
        // Calcular aeropuertos únicos
        const uniqueAirports = new Set();
        pilot.flights.forEach(flight => {
          uniqueAirports.add(flight.departureIcao);
          uniqueAirports.add(flight.arrivalIcao);
        });

        // Calcular vuelos del mes actual
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyFlights = pilot.flights.filter(f => 
          new Date(f.createdAt) >= currentMonthStart
        ).length;

        // Calcular horas del mes
        let monthlyHours = 0;
        pilot.flights
          .filter(f => new Date(f.createdAt) >= currentMonthStart)
          .forEach(flight => {
            if (flight.startFlight && flight.closeFlight) {
              const duration = (new Date(flight.closeFlight) - new Date(flight.startFlight)) / (1000 * 60 * 60);
              monthlyHours += duration;
            }
          });

        // Crear o actualizar PilotStats
        await prisma.pilotStats.upsert({
          where: { pilotId: pilot.id },
          update: {
            totalFlights,
            totalHours,
            uniqueAirports: uniqueAirports.size,
            monthlyFlights,
            monthlyHours,
            gamificationPoints: (totalFlights * 10) + (Math.floor(totalHours) * 5) // Puntos base
          },
          create: {
            pilotId: pilot.id,
            totalFlights,
            totalHours,
            uniqueAirports: uniqueAirports.size,
            monthlyFlights,
            monthlyHours,
            gamificationPoints: (totalFlights * 10) + (Math.floor(totalHours) * 5)
          }
        });

        // Desbloquear hitos de carrera basados en el histórico
        const milestones = await prisma.careerMilestone.findMany();
        
        for (const milestone of milestones) {
          let shouldUnlock = false;
          
          if (milestone.type === 'HOURS' && milestone.requiredHours) {
            shouldUnlock = totalHours >= milestone.requiredHours;
          } else if (milestone.type === 'FLIGHTS' && milestone.requiredFlights) {
            shouldUnlock = totalFlights >= milestone.requiredFlights;
          }
          
          if (shouldUnlock) {
            await prisma.pilotCareerProgress.upsert({
              where: {
                pilotId_milestoneId: {
                  pilotId: pilot.id,
                  milestoneId: milestone.id
                }
              },
              update: {},
              create: {
                pilotId: pilot.id,
                milestoneId: milestone.id,
                unlockedAt: new Date()
              }
            });
          }
        }

        // Crear progreso del Battle Pass actual si no existe
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
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
          for (const challenge of battlePass.challenges) {
            let currentValue = 0;
            let completed = false;

            // Calcular progreso basado en el tipo
            if (challenge.type === 'FLIGHTS') {
              currentValue = monthlyFlights;
              completed = currentValue >= challenge.targetValue;
            } else if (challenge.type === 'HOURS') {
              currentValue = Math.floor(monthlyHours);
              completed = currentValue >= challenge.targetValue;
            } else if (challenge.type === 'AIRPORTS') {
              // Calcular aeropuertos únicos del mes
              const monthlyAirports = new Set();
              pilot.flights
                .filter(f => new Date(f.createdAt) >= currentMonthStart)
                .forEach(flight => {
                  monthlyAirports.add(flight.departureIcao);
                  monthlyAirports.add(flight.arrivalIcao);
                });
              currentValue = monthlyAirports.size;
              completed = currentValue >= challenge.targetValue;
            }

            await prisma.pilotBattlePassProgress.upsert({
              where: {
                pilotId_battlePassId_challengeId: {
                  pilotId: pilot.id,
                  battlePassId: battlePass.id,
                  challengeId: challenge.id
                }
              },
              update: {
                currentValue,
                completed,
                completedAt: completed ? new Date() : null
              },
              create: {
                pilotId: pilot.id,
                battlePassId: battlePass.id,
                challengeId: challenge.id,
                currentValue,
                completed,
                completedAt: completed ? new Date() : null
              }
            });
          }
        }

        // Otorgar logros básicos
        const achievements = await prisma.achievement.findMany();
        
        // Logro de primera conexión
        const firstConnection = achievements.find(a => a.name === 'Primera Conexión');
        if (firstConnection) {
          await prisma.pilotAchievement.upsert({
            where: {
              pilotId_achievementId: {
                pilotId: pilot.id,
                achievementId: firstConnection.id
              }
            },
            update: {},
            create: {
              pilotId: pilot.id,
              achievementId: firstConnection.id
            }
          });
        }

        // Logros de exploración
        if (uniqueAirports.size >= 10) {
          const traveler = achievements.find(a => a.name === 'Viajero');
          if (traveler) {
            await prisma.pilotAchievement.upsert({
              where: {
                pilotId_achievementId: {
                  pilotId: pilot.id,
                  achievementId: traveler.id
                }
              },
              update: {},
              create: {
                pilotId: pilot.id,
                achievementId: traveler.id
              }
            });
          }
        }

        if (uniqueAirports.size >= 50) {
          const explorer = achievements.find(a => a.name === 'Explorador Global');
          if (explorer) {
            await prisma.pilotAchievement.upsert({
              where: {
                pilotId_achievementId: {
                  pilotId: pilot.id,
                  achievementId: explorer.id
                }
              },
              update: {},
              create: {
                pilotId: pilot.id,
                achievementId: explorer.id
              }
            });
          }
        }

        if (uniqueAirports.size >= 100) {
          const worldCitizen = achievements.find(a => a.name === 'Ciudadano del Mundo');
          if (worldCitizen) {
            await prisma.pilotAchievement.upsert({
              where: {
                pilotId_achievementId: {
                  pilotId: pilot.id,
                  achievementId: worldCitizen.id
                }
              },
              update: {},
              create: {
                pilotId: pilot.id,
                achievementId: worldCitizen.id
              }
            });
          }
        }

        processedCount++;
        console.log(`Procesado piloto ${pilot.callsign || pilot.email} (${processedCount}/${pilots.length})`);
        
      } catch (pilotError) {
        console.error(`Error procesando piloto ${pilot.id}:`, pilotError);
        errors.push({
          pilotId: pilot.id,
          callsign: pilot.callsign,
          error: pilotError.message
        });
      }
    }

    res.json({
      message: 'Cálculo histórico completado',
      totalPilots: pilots.length,
      processedPilots: processedCount,
      errors: errors.length,
      errorDetails: errors
    });

  } catch (error) {
    console.error('Error en cálculo histórico:', error);
    res.status(500).json({ 
      error: 'Error al calcular el histórico',
      details: error.message 
    });
  }
});

// Endpoint para recalcular estadísticas de un piloto específico
router.post('/recalculate-pilot/:pilotId', async (req, res) => {
  try {
    const { pilotId } = req.params;
    
    const pilot = await prisma.pilot.findUnique({
      where: { id: parseInt(pilotId) },
      include: {
        flights: {
          where: {
            status: 2 // Solo vuelos aceptados
          }
        }
      }
    });

    if (!pilot) {
      return res.status(404).json({ error: 'Piloto no encontrado' });
    }

    // RECALCULAR HORAS TOTALES DESDE LOS VUELOS
    let totalHours = 0;
    
    pilot.flights.forEach(flight => {
      if (flight.startFlight && flight.closeFlight) {
        const durationMs = new Date(flight.closeFlight) - new Date(flight.startFlight);
        const flightHours = durationMs / (1000 * 60 * 60); // Convert to decimal hours
        totalHours += flightHours;
      }
    });
    
    // ACTUALIZAR LAS HORAS EN LA TABLA PILOT
    await prisma.pilot.update({
      where: { id: pilot.id },
      data: {
        hours: totalHours
      }
    });

    // Calcular estadísticas adicionales
    const totalFlights = pilot.flights.length;
    
    const uniqueAirports = new Set();
    pilot.flights.forEach(flight => {
      uniqueAirports.add(flight.departureIcao);
      uniqueAirports.add(flight.arrivalIcao);
    });

    // Actualizar PilotStats
    const stats = await prisma.pilotStats.upsert({
      where: { pilotId: pilot.id },
      update: {
        totalFlights,
        totalHours,
        uniqueAirports: uniqueAirports.size,
        gamificationPoints: (totalFlights * 10) + (Math.floor(totalHours) * 5)
      },
      create: {
        pilotId: pilot.id,
        totalFlights,
        totalHours,
        uniqueAirports: uniqueAirports.size,
        gamificationPoints: (totalFlights * 10) + (Math.floor(totalHours) * 5)
      }
    });

    res.json({
      message: 'Estadísticas recalculadas',
      pilot: {
        id: pilot.id,
        callsign: pilot.callsign,
        email: pilot.email,
        hoursRecalculated: `${totalHours.toFixed(2)}h`
      },
      stats
    });

  } catch (error) {
    console.error('Error recalculando piloto:', error);
    res.status(500).json({ 
      error: 'Error al recalcular estadísticas del piloto',
      details: error.message 
    });
  }
});

// Endpoint para recalcular las horas de TODOS los pilotos desde sus vuelos
router.post('/recalculate-all-hours', async (req, res) => {
  try {
    console.log('Iniciando recálculo de horas para todos los pilotos...');
    
    // Obtener todos los rangos ordenados por horas
    const ranks = await prisma.rank.findMany({
      orderBy: { hours: 'asc' }
    });
    
    // Obtener todos los pilotos con sus vuelos aceptados
    const pilots = await prisma.pilot.findMany({
      include: {
        flights: {
          where: {
            status: 2 // Solo vuelos aceptados
          }
        }
      }
    });

    let updatedCount = 0;
    let ranksUpdatedCount = 0;
    let errors = [];
    
    for (const pilot of pilots) {
      try {
        // Recalcular horas totales desde los vuelos
        let totalHours = 0;
        
        pilot.flights.forEach(flight => {
          if (flight.startFlight && flight.closeFlight) {
            const durationMs = new Date(flight.closeFlight) - new Date(flight.startFlight);
            const flightHours = durationMs / (1000 * 60 * 60); // Convert to decimal hours
            totalHours += flightHours;
          }
        });
        
        // Determinar el rango apropiado basado en las horas
        let appropriateRank = ranks[0]; // Rango más bajo por defecto
        for (const rank of ranks) {
          if (totalHours >= rank.hours) {
            appropriateRank = rank;
          } else {
            break; // Salir cuando encontramos un rango que requiere más horas
          }
        }
        
        // Actualizar horas y rango si es necesario
        const updateData = { hours: totalHours };
        let needsRankUpdate = false;
        
        if (!pilot.rankId || pilot.rankId !== appropriateRank.id) {
          updateData.rankId = appropriateRank.id;
          needsRankUpdate = true;
          ranksUpdatedCount++;
        }
        
        // Only update if there are hours to update or rank needs updating
        if (totalHours > 0 || needsRankUpdate) {
          // Actualizar las horas y rango en la tabla Pilot
          await prisma.pilot.update({
            where: { id: pilot.id },
            data: updateData
          });
          
          updatedCount++;
          console.log(`Actualizado piloto ${pilot.callsign || pilot.email}: ${totalHours.toFixed(2)}h, Rango: ${appropriateRank.name}`);
        }
        
      } catch (error) {
        console.error(`Error actualizando piloto ${pilot.id}:`, error);
        errors.push({
          pilotId: pilot.id,
          callsign: pilot.callsign,
          error: error.message
        });
      }
    }
    
    res.json({
      message: 'Recálculo de horas completado',
      totalPilots: pilots.length,
      updatedPilots: updatedCount,
      ranksUpdated: ranksUpdatedCount,
      errors: errors.length,
      errorDetails: errors
    });
    
  } catch (error) {
    console.error('Error recalculando horas:', error);
    res.status(500).json({ 
      error: 'Error al recalcular las horas',
      details: error.message 
    });
  }
});


module.exports = router;