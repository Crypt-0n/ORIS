/**
 * Shared utility functions for TLP/PAP color mapping.
 * Centralized to avoid duplication across routes.
 */

const getTlpColor = (code) => {
    switch (code) {
        case 'RED': return '#FF2B2B';
        case 'AMBER': return '#FFC000';
        case 'AMBER+STRICT': return '#FFC000';
        case 'GREEN': return '#33FF00';
        case 'CLEAR': return '#FFFFFF';
        case 'WHITE': return '#FFFFFF';
        default: return '#6b7280';
    }
};

const getPapColor = (code) => {
    switch (code) {
        case 'RED': return '#FF2B2B';
        case 'AMBER': return '#FFC000';
        case 'GREEN': return '#33FF00';
        case 'CLEAR': return '#FFFFFF';
        case 'WHITE': return '#FFFFFF';
        default: return '#6b7280';
    }
};

module.exports = { getTlpColor, getPapColor };
