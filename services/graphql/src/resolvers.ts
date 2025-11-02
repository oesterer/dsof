import type { Pool } from 'mysql2/promise';
import {
  getConstellationLinePoints,
  getConstellations,
  getMessierObject,
  getMessierObjects,
  getOrbitalElements,
  getPlanet,
  getPlanets,
  getStarByHr,
  getStars,
} from './dataAccess.js';

export interface GraphQLContext {
  db: Pool;
}

export const resolvers = {
  Query: {
    constellations: async (_: unknown, args: { abbreviation?: string }, ctx: GraphQLContext) => {
      return getConstellations(ctx.db, args.abbreviation);
    },
    constellation: async (_: unknown, args: { abbreviation: string }, ctx: GraphQLContext) => {
      const results = await getConstellations(ctx.db, args.abbreviation);
      return results[0] ?? null;
    },
    stars: async (
      _: unknown,
      args: { limit?: number; minMagnitude?: number; maxMagnitude?: number; constellation?: string },
      ctx: GraphQLContext
    ) => {
      return getStars(ctx.db, {
        limit: args.limit,
        minMagnitude: args.minMagnitude,
        maxMagnitude: args.maxMagnitude,
        constellationAbbreviation: args.constellation,
      });
    },
    star: async (_: unknown, args: { hrNumber: number }, ctx: GraphQLContext) => {
      return getStarByHr(ctx.db, args.hrNumber);
    },
    messierObjects: async (
      _: unknown,
      args: { objectType?: string; constellation?: string },
      ctx: GraphQLContext
    ) => {
      return getMessierObjects(ctx.db, {
        objectType: args.objectType,
        constellationAbbreviation: args.constellation,
      });
    },
    messierObject: async (_: unknown, args: { designation: string }, ctx: GraphQLContext) => {
      return getMessierObject(ctx.db, args.designation);
    },
    planets: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      return getPlanets(ctx.db);
    },
    planet: async (_: unknown, args: { name: string }, ctx: GraphQLContext) => {
      return getPlanet(ctx.db, args.name);
    },
  },
  Constellation: {
    linePoints: async (parent: { abbreviation: string }, _: unknown, ctx: GraphQLContext) => {
      return getConstellationLinePoints(ctx.db, parent.abbreviation);
    },
    stars: async (
      parent: { abbreviation: string },
      args: { limit?: number; minMagnitude?: number; maxMagnitude?: number },
      ctx: GraphQLContext
    ) => {
      return getStars(ctx.db, {
        limit: args.limit,
        minMagnitude: args.minMagnitude,
        maxMagnitude: args.maxMagnitude,
        constellationAbbreviation: parent.abbreviation,
      });
    },
    messierObjects: async (parent: { abbreviation: string }, _: unknown, ctx: GraphQLContext) => {
      return getMessierObjects(ctx.db, { constellationAbbreviation: parent.abbreviation });
    },
  },
  Star: {
    constellation: async (parent: { constellationAbbreviation?: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!parent.constellationAbbreviation) {
        return null;
      }
      const results = await getConstellations(ctx.db, parent.constellationAbbreviation);
      return results[0] ?? null;
    },
  },
  MessierObject: {
    constellation: async (parent: { constellationAbbreviation?: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!parent.constellationAbbreviation) {
        return null;
      }
      const results = await getConstellations(ctx.db, parent.constellationAbbreviation);
      return results[0] ?? null;
    },
  },
  Planet: {
    orbitalElements: async (parent: { name: string }, _: unknown, ctx: GraphQLContext) => {
      return getOrbitalElements(ctx.db, parent.name);
    },
  },
  PlanetOrbitalElements: {
    semiMajorAxisAu: (parent: { semiMajorAxisAu?: number | null }) => parent.semiMajorAxisAu,
    eccentricity: (parent: { eccentricity?: number | null }) => parent.eccentricity,
    inclinationDeg: (parent: { inclinationDeg?: number | null }) => parent.inclinationDeg,
    longitudeAscendingNodeDeg: (parent: { longitudeAscendingNodeDeg?: number | null }) => parent.longitudeAscendingNodeDeg,
    longitudePerihelionDeg: (parent: { longitudePerihelionDeg?: number | null }) => parent.longitudePerihelionDeg,
    meanLongitudeDeg: (parent: { meanLongitudeDeg?: number | null }) => parent.meanLongitudeDeg,
    meanMotionDegPerDay: (parent: { meanMotionDegPerDay?: number | null }) => parent.meanMotionDegPerDay,
  },
};
