package com.dsof.rest.model;

public record ConstellationLinePointDto(
        int lineIndex,
        int pointIndex,
        double raHours,
        double decDeg
) {
}
