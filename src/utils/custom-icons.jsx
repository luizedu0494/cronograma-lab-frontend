// src/utils/custom-icons.js
import React from 'react';
import PublicIcon from '@mui/icons-material/Public';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import CastleIcon from '@mui/icons-material/Castle';
import BlockIcon from '@mui/icons-material/Block';

export function HolidayIcon({ type }) {
    switch (type) {
        case 'nacional':
            return <PublicIcon fontSize="small" />;
        case 'estadual':
            return <CastleIcon fontSize="small" />;
        case 'municipal':
            return <LocationCityIcon fontSize="small" />;
        default:
            return <BlockIcon fontSize="small" />;
    }
}