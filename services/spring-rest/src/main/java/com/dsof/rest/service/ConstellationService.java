package com.dsof.rest.service;

import com.dsof.rest.model.ConstellationDetailDto;
import com.dsof.rest.model.ConstellationDto;
import com.dsof.rest.model.ConstellationLinePointDto;
import com.dsof.rest.model.MessierObjectDto;
import com.dsof.rest.model.StarDto;
import com.dsof.rest.model.StarQuery;
import com.dsof.rest.repository.ConstellationRepository;
import com.dsof.rest.repository.MessierRepository;
import com.dsof.rest.repository.StarRepository;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class ConstellationService {

    private final ConstellationRepository constellationRepository;
    private final StarRepository starRepository;
    private final MessierRepository messierRepository;

    public ConstellationService(ConstellationRepository constellationRepository,
                                 StarRepository starRepository,
                                 MessierRepository messierRepository) {
        this.constellationRepository = constellationRepository;
        this.starRepository = starRepository;
        this.messierRepository = messierRepository;
    }

    public List<ConstellationDto> listConstellations(String abbreviation) {
        return constellationRepository.findConstellations(abbreviation);
    }

    public Optional<ConstellationDto> findConstellation(String abbreviation) {
        List<ConstellationDto> list = constellationRepository.findConstellations(abbreviation);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public Optional<ConstellationDetailDto> getConstellationDetail(String abbreviation,
                                                                    boolean includeStars,
                                                                    boolean includeMessier,
                                                                    StarQuery starQuery) {
        Optional<ConstellationDto> constellationOpt = findConstellation(abbreviation);
        if (constellationOpt.isEmpty()) {
            return Optional.empty();
        }

        List<ConstellationLinePointDto> linePoints = constellationRepository.findLinePoints(abbreviation);
        List<StarDto> stars = includeStars
                ? starRepository.findStars(starQuery)
                : Collections.emptyList();
        List<MessierObjectDto> messierObjects = includeMessier
                ? messierRepository.findMessierObjects(null, abbreviation)
                : Collections.emptyList();

        ConstellationDetailDto detail = new ConstellationDetailDto(
                constellationOpt.get(),
                linePoints,
                stars,
                messierObjects
        );
        return Optional.of(detail);
    }
}
