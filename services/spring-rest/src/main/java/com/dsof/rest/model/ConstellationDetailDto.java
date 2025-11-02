package com.dsof.rest.model;

import java.util.List;

public record ConstellationDetailDto(
        ConstellationDto constellation,
        List<ConstellationLinePointDto> linePoints,
        List<StarDto> stars,
        List<MessierObjectDto> messierObjects
) {
}
