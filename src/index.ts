import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'directus-labs-address-completion-interface',
	name: 'Address completion',
	icon: 'box',
	description: 'Use Google Places autocomplete Data API as an Address Completion interface!',
	component: InterfaceComponent,
	options: [
		{
			field: 'apiKeyGMaps',
			name: 'Google Maps API Key',
			type: 'string',
			meta: {
				required: true,
				options: {
					masked: true,
				},
				width: 'full',
				interface: 'input',
			},
		},
		{
			field: 'iconLeft',
			name: '$t:icon_left',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-icon',
			},
		},
		{
			field: 'iconRight',
			name: '$t:icon_right',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-icon',
			},
		},
		{
			field: 'displayMap',
			name: 'Display map',
			type: 'boolean',
			meta: {
				required: true,
				width: 'half',
				interface: 'checkbox',
			},
			schema: {
				default_value: true,
			},
		},
		{
			field: 'markerDraggable',
			name: 'Enable marker dragging',
			type: 'boolean',
			meta: {
				required: true,
				width: 'half',
				interface: 'checkbox',
				note: 'Allow users to reposition the selected marker directly on the map.',
			},
			schema: {
				default_value: false,
			},
		},
		{
			field: 'autocompleteFetchOptions',
			name: 'Autocomplete Fetch Options',
			type: 'json',
			meta: {
				width: 'full',
				interface: 'code',
				note: 'Check the [documentation](https://developers.google.com/maps/documentation/javascript/reference/autocomplete-data#AutocompleteSuggestion.fetchAutocompleteSuggestions) for possible options',
			},
		},
		{
			field: 'latField',
			name: 'Latitude field key',
			type: 'string',
			meta: {
				interface: 'input',
				width: 'half',
				note: 'Field key in this collection that should receive latitude (default: lat).',
			},
			schema: {
				default_value: 'lat',
			},
		},
		{
			field: 'lngField',
			name: 'Longitude field key',
			type: 'string',
			meta: {
				interface: 'input',
				width: 'half',
				note: 'Field key in this collection that should receive longitude (default: lng).',
			},
			schema: {
				default_value: 'lng',
			},
		},
	],
	types: ['json'],
});
