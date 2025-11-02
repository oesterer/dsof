export const typeDefs = /* GraphQL */ `
type Constellation {
  abbreviation: String!
  name: String!
  rankOrder: Int
  labelRaHours: Float
  labelDecDeg: Float
  linePoints: [ConstellationLinePoint!]!
  stars(limit: Int, minMagnitude: Float, maxMagnitude: Float): [Star!]!
  messierObjects: [MessierObject!]!
}

type ConstellationLinePoint {
  lineIndex: Int!
  pointIndex: Int!
  raHours: Float!
  decDeg: Float!
}

type Star {
  hrNumber: Int!
  name: String!
  raHours: Float!
  decDeg: Float!
  magnitude: Float
  flamsteedDesignation: String
  bayerDesignation: String
  constellation: Constellation
}

type MessierObject {
  designation: String!
  name: String
  objectType: String!
  raHours: Float!
  decDeg: Float!
  constellation: Constellation
}

type Planet {
  name: String!
  displayName: String!
  colorHex: String
  size: Int
  icon: String
  orbitalElements: PlanetOrbitalElements
}

type PlanetOrbitalElements {
  semiMajorAxisAu: Float
  eccentricity: Float
  inclinationDeg: Float
  longitudeAscendingNodeDeg: Float
  longitudePerihelionDeg: Float
  meanLongitudeDeg: Float
  meanMotionDegPerDay: Float
}

type Query {
  constellations(abbreviation: String): [Constellation!]!
  constellation(abbreviation: String!): Constellation
  stars(limit: Int, minMagnitude: Float, maxMagnitude: Float, constellation: String): [Star!]!
  star(hrNumber: Int!): Star
  messierObjects(objectType: String, constellation: String): [MessierObject!]!
  messierObject(designation: String!): MessierObject
  planets: [Planet!]!
  planet(name: String!): Planet
}
`;
