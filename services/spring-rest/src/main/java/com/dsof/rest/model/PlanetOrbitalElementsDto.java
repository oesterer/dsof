package com.dsof.rest.model;

public record PlanetOrbitalElementsDto(
        String planetName,
        Double semiMajorAxisAu,
        Double eccentricity,
        Double inclinationDeg,
        Double longitudeAscendingNodeDeg,
        Double longitudePerihelionDeg,
        Double meanLongitudeDeg,
        Double meanMotionDegPerDay
) {
}
