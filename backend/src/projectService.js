const { PrismaClient } = require('@prisma/client');
const { parseKmzFile } = require('./kmzParser');

const prisma = new PrismaClient();

/**
 * Parses a KMZ file and persists the entire hierarchy (Project -> ProjectFdt -> ProjectFat -> ProjectHomepass + ProjectPole)
 * in the Prisma database.
 */
async function createProjectFromKmz({
  filePath,
  originalName,
  fileSize,
  userId,
  overrides = {},
}) {
  const parsed = await parseKmzFile(filePath);

  const projectData = {
    clusterCode: overrides.clusterCode || parsed.clusterCode,
    clusterName: overrides.clusterName || parsed.clusterName,
    description: overrides.description ?? parsed.description,
    oltName: overrides.oltName || parsed.oltName,
    feederCode: overrides.feederCode || parsed.feederCode,
    region: overrides.region || parsed.region,
    province: overrides.province || parsed.province,
    regencyCity: overrides.regencyCity || parsed.regencyCity,
    district: overrides.district || parsed.district,
    subdistrict: overrides.subdistrict || parsed.subdistrict,
    postalCode: String(overrides.postalCode || parsed.postalCode),
    fatAddress: overrides.fatAddress || parsed.fatAddress,
    addressPrefix: overrides.addressPrefix || parsed.addressPrefix || 'JLN.',
    street: overrides.street || parsed.street,
    netType: overrides.netType || parsed.netType || 'Aerial',
    dwellingType: overrides.dwellingType || parsed.dwellingType || 'SDU',
    homepassSource: overrides.homepassSource || parsed.homepassSource || 'RFS',
    installationType: overrides.installationType || parsed.installationType || 'AE',
    networkPresence: Number(overrides.networkPresence ?? parsed.networkPresence ?? 31),
    rollOutId: overrides.rollOutId || null,
    projectIdCode: overrides.projectIdCode || null,
    complexName: overrides.complexName || null,
    kmzFileName: originalName,
    kmzFilePath: filePath,
    kmzFileSize: fileSize,
    boundaryCoordsJson: parsed.boundaryCoordsJson,
    totalFdt: parsed.totalFdt,
    totalFat: parsed.totalFat,
    totalHomepass: parsed.totalHomepass,
    totalUncoverHp: parsed.totalUncoverHp,
    totalPoles: parsed.totalPoles,
    totalCableRouteM: parsed.totalCableRouteM,
    totalCableLengthM: parsed.totalCableLengthM,
    totalSlingWireM: parsed.totalSlingWireM,
    createdById: userId,
  };

  const createdProject = await prisma.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: projectData,
    });

    // Insert Poles
    if (parsed.poles && parsed.poles.length > 0) {
      await tx.projectPole.createMany({
        data: parsed.poles.map((p) => ({
          projectId: proj.id,
          fdtIndex: p.fdtIndex,
          lineName: p.lineName,
          poleCategory: p.poleCategory,
          poleId: p.poleId,
          latitude: p.latitude,
          longitude: p.longitude,
          isAutoCad: p.isAutoCad,
        })),
      });
    }

    // Insert FDTs, FATs, and Homepasses
    for (const fdt of parsed.fdts) {
      const createdFdt = await tx.projectFdt.create({
        data: {
          projectId: proj.id,
          fdtIndex: fdt.fdtIndex,
          sheetName: fdt.sheetName,
          fdtId: fdt.fdtId,
          fdtCapacity: fdt.fdtCapacity,
          oltCode: fdt.oltCode,
          oltName: fdt.oltName,
          latitude: fdt.latitude,
          longitude: fdt.longitude,
          coordString: fdt.coordString,
          totalHp: fdt.totalHp,
          totalFat: fdt.totalFat,
          routeLineA24: fdt.routeLineA24,
          routeLineB24: fdt.routeLineB24,
          routeLineC24: fdt.routeLineC24,
          routeLineD24: fdt.routeLineD24,
          routeLineA36: fdt.routeLineA36,
          routeLineB36: fdt.routeLineB36,
          routeLineC36: fdt.routeLineC36,
          routeLineD36: fdt.routeLineD36,
          routeLineA48: fdt.routeLineA48,
          routeLineB48: fdt.routeLineB48,
          routeLineC48: fdt.routeLineC48,
          routeLineD48: fdt.routeLineD48,
          slingWireFormula: fdt.slingWireFormula || null,
          slingWireRouteM: fdt.slingWireRouteM,
          fatCountLineA: fdt.fatCountLineA,
          fatCountLineB: fdt.fatCountLineB,
          fatCountLineC: fdt.fatCountLineC,
          fatCountLineD: fdt.fatCountLineD,
          newPole7m5: fdt.newPole7m5,
          newPole7m4: fdt.newPole7m4,
          newPole7m3: fdt.newPole7m3,
          newPole7m25: fdt.newPole7m25,
          newPole9m5: fdt.newPole9m5,
          newPole9m4: fdt.newPole9m4,
          extPoleLn: fdt.extPoleLn,
          extPoleMti: fdt.extPoleMti,
          extPoleMr: fdt.extPoleMr,
          cableRoutesJson: fdt.cableRoutes ? JSON.stringify(fdt.cableRoutes) : null,
        },
      });

      for (const fat of fdt.fats) {
        const createdFat = await tx.projectFat.create({
          data: {
            projectId: proj.id,
            fdtDbId: createdFdt.id,
            orderIndex: fat.orderIndex,
            fatCode: fat.fatCode,
            fullFatName: fat.fullFatName,
            lineName: fat.lineName,
            lineCapacity: fat.lineCapacity,
            fdtTray: fat.fdtTray,
            fdtPort: fat.fdtPort,
            tubeColour: fat.tubeColour,
            coreNumber1: fat.coreNumber1,
            coreNumber2: fat.coreNumber2,
            latitude: fat.latitude,
            longitude: fat.longitude,
            poleId: fat.poleId,
            poleLatitude: fat.poleLatitude,
            poleLongitude: fat.poleLongitude,
            hpCount: fat.hpCount,
            fatAddress: fat.fatAddress || projectData.fatAddress || null,
            boundaryJson: fat.boundaryJson,
          },
        });

        if (fat.homepasses && fat.homepasses.length > 0) {
          await tx.projectHomepass.createMany({
            data: fat.homepasses.map((hp) => ({
              projectId: proj.id,
              fdtDbId: createdFdt.id,
              fatDbId: createdFat.id,
              fatPort: hp.fatPort,
              homeNumber: hp.homeNumber,
              latitude: hp.latitude,
              longitude: hp.longitude,
              rw: null,
              rt: null,
            })),
          });
        }
      }
    }

    return proj;
  }, {
    maxWait: 30000,
    timeout: 120000,
  });

  return getFullProjectById(createdProject.id);
}

/**
 * Loads a project with its complete FDT -> FAT -> Homepass + Poles tree
 */
async function getFullProjectById(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          role: true,
          department: true,
        },
      },
      fdts: {
        orderBy: { fdtIndex: 'asc' },
        include: {
          fats: {
            orderBy: { orderIndex: 'asc' },
            include: {
              homepasses: {
                orderBy: { fatPort: 'asc' },
              },
            },
          },
        },
      },
      poles: true,
      exportHistories: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: {
            select: { fullName: true, username: true },
          },
        },
      },
    },
  });

  return project;
}

module.exports = {
  prisma,
  createProjectFromKmz,
  getFullProjectById,
};
