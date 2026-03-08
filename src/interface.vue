<script setup lang="ts">
import type { PropType, Ref } from 'vue';
import { Loader } from '@googlemaps/js-api-loader';
import { inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import googleLogoDark from './assets/images/google_on_non_white_hdpi.png';
import googleLogo from './assets/images/google_on_white_hdpi.png';
import { getCurrentLanguage } from './utils/get-current-lang';

interface AutocompleteLocation {
	placeId: string;
	text: string;
	place: google.maps.places.Place;
}

type Coordinates = [number, number];

interface GeoProperties {
	displayName: string;
	country: string; // ISO 3166-2
	administrativeArea: string;
	postalCode: string;
	city: string;
	street: string;
	formated: string;
	raw: google.maps.places.AddressComponent[];
	viewport: google.maps.LatLngBounds;
}

interface GeoJsonFeature {
	geometry: {
		coordinates: Coordinates;
		type: 'Point';
	};
	properties: Partial<GeoProperties>;
	type: 'Feature';
}

type MapType = 'hybrid' | 'roadmap' | 'satellite' | 'terrain';

const props = defineProps({
	value: {
		type: Object as PropType<GeoJsonFeature> | null,
		default: null,
	},
	disabled: {
		type: Boolean,
		default: false,
	},
	apiKeyGMaps: {
		type: String,
		required: true,
	},
	displayMap: {
		type: Boolean,
		default: true,
	},
	iconLeft: {
		type: String,
		default: null,
	},
	iconRight: {
		type: String,
		default: null,
	},
	autocompleteFetchOptions: {
		type: Object,
		default: () => ({}),
	},
	latField: {
		type: String,
		default: 'lat',
	},
	lngField: {
		type: String,
		default: 'lng',
	},
	cityField: {
		type: String,
		default: null,
	},
	addressField: {
		type: String,
		default: null,
	},
	markerDraggable: {
		type: Boolean,
		default: false,
	},
});

type MappedFieldValue = string | number | null;

const emit = defineEmits<{
	input: [GeoJsonFeature | null];
	setFieldValue: [field: string, value: MappedFieldValue] | [payload: { field: string; value: MappedFieldValue }];
	'set-field-value': [payload: { field: string; value: MappedFieldValue }];
}>();

const { t } = useI18n();

const results = ref<AutocompleteLocation[]>([]);
const sessionToken = ref<google.maps.places.AutocompleteSessionToken | null>(null);
const searchInput = ref<string | null>(null);
const selectedPlaceId = ref<string | null>(null);
const mapContainer = ref<HTMLElement | null>(null);
const searchContainer = ref<HTMLElement | null>(null);
const mapTypeSelectContainer = ref<HTMLElement | null>(null);
const mapControlsContainer = ref<HTMLElement | null>(null);
const hasMounted = ref(false);
const isFullscreen = ref(false);
const mapType = ref<MapType>('roadmap');
const controlsReady = ref(false);
const values = inject<Ref<Record<string, unknown>> | null>('values', null);
const selectedCity = ref<string | null>(null);
const selectedAddress = ref<string | null>(null);

const isDark = document.body.classList.contains('dark');
const lang = getCurrentLanguage();

let placesLibrary: google.maps.PlacesLibrary;
let mapsLibrary: google.maps.MapsLibrary;
let markerLibrary: google.maps.MarkerLibrary;
let map: google.maps.Map;
let marker: google.maps.marker.AdvancedMarkerElement | null = null;
let markerDragEndListener: google.maps.MapsEventListener | null = null;

onMounted(async () => {
	const loader = new Loader({
		apiKey: props.apiKeyGMaps,
		libraries: ['places', 'maps', 'marker'],
		version: 'weekly',
	});

	placesLibrary = await loader.importLibrary('places');
	mapsLibrary = await loader.importLibrary('maps');
	markerLibrary = await loader.importLibrary('marker');

	setNewSessionToken();
	initMap();
	hasMounted.value = true;
});

onUnmounted(() => {
	if (map) {
		google.maps.event.clearListeners(map, 'tilesloaded');
	}

	removeMarkerDragEndListener();
});

watch(() => props.value, (newValue) => {
	if (!hasMounted.value) {
		return;
	}

	if (!newValue) {
		if (marker) {
			marker.map = null;
		}

		searchInput.value = null;
		selectedCity.value = null;
		selectedAddress.value = null;

		return;
	}

	selectedCity.value = newValue.properties?.city ?? null;
	selectedAddress.value = newValue.properties?.street ?? newValue.properties?.formated ?? null;
	setMapValue();
});

watch(
	() => [props.markerDraggable, props.disabled] as const,
	() => {
		if (marker) {
			setMarkerDraggableBehavior(marker);
		}
	},
);

function setNewSessionToken() {
	sessionToken.value = new placesLibrary.AutocompleteSessionToken();
}

async function onInput(value: string) {
	searchInput.value = value;
	makeAutocompleteRequest();
}

async function makeAutocompleteRequest() {
	if (!searchInput.value) {
		results.value = [];
		return;
	}

	const request = {
		input: searchInput.value,
		sessionToken: sessionToken.value!,
		language: lang,
	};

	try {
		const { suggestions } = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({ ...request, ...props.autocompleteFetchOptions });

		// Make sure to return a custom object, as the original object doesn't play well with vues reactivity (e.g the getter functions)
		results.value = suggestions
			.filter((suggestion) => suggestion !== null)
			.map((suggestion) => {
				const placePrediction = suggestion.placePrediction!;

				return {
					placeId: placePrediction.placeId,
					text: placePrediction.text.toString(),
					place: placePrediction.toPlace(),
				};
			});
	}
	catch (error) {
		console.error(error);
	}
}

async function onPlaceSelected(location: AutocompleteLocation) {
	searchInput.value = location.text;
	selectedPlaceId.value = location.placeId;

	const placeData = await location.place.fetchFields({
		fields: ['location', 'displayName', 'addressComponents', 'viewport', 'formattedAddress', 'displayName'],
	});

	const lat = placeData.place.location?.lat();
	const lng = placeData.place.location?.lng();

	if (lat !== undefined && lng !== undefined) {
		const location = new google.maps.LatLng(lat, lng);
		setMapLocation(location, placeData.place.viewport);

		const geoData: GeoJsonFeature = {
			geometry: {
				coordinates: [lng, lat],
				type: 'Point',
			},
			properties: getProperties(placeData.place),
			type: 'Feature',
		};

			selectedCity.value = geoData.properties.city ?? null;
			selectedAddress.value = geoData.properties.street ?? geoData.properties.formated ?? null;
			emit('input', geoData);
			setMappedFields(lat, lng, geoData.properties.city ?? null, geoData.properties.street ?? null);
		}

	setNewSessionToken();
}

function getProperties(place: google.maps.places.Place): GeoProperties {
	let properties = {} as GeoProperties;

	if (place.addressComponents) {
		const country = getadressComponent(place.addressComponents, 'country', 'shortText');
		const postalCode = getadressComponent(place.addressComponents, 'postal_code', 'longText');
		const administrativeArea = getadressComponent(place.addressComponents, 'administrative_area_level_1', 'longText');
		const city = getCity(place.addressComponents);
		const street = getStreet(place.addressComponents);

		properties = {
			...properties,
			...(country && { country }),
			...(postalCode && { postalCode }),
			...(administrativeArea && { administrativeArea }),
			...(city && { city }),
			...(street && { street }),
		};

		properties.raw = place.addressComponents;
	}

	if (place.displayName) {
		properties.displayName = place.displayName;
	}

	if (place.formattedAddress) {
		properties.formated = place.formattedAddress;
	}

	if (properties) {
		properties.viewport = place.viewport!;
	}

	return properties;
}

function getadressComponent(addressComponents: google.maps.places.Place['addressComponents'], type: string, valueKey: 'longText' | 'shortText') {
	if (!addressComponents) {
		return;
	}

	const component = addressComponents.filter((address_component) => {
		return address_component.types.includes(type);
	});

	if (component && component[0]) {
		return component[0][valueKey];
	}
}

function getCity(addressComponents: google.maps.places.Place['addressComponents']) {
	if (!addressComponents) {
		return;
	}

	return (
		getadressComponent(addressComponents, 'locality', 'longText')
		?? getadressComponent(addressComponents, 'postal_town', 'longText')
		?? getadressComponent(addressComponents, 'administrative_area_level_3', 'longText')
		?? getadressComponent(addressComponents, 'administrative_area_level_2', 'longText')
	);
}

function getStreet(addressComponents: google.maps.places.Place['addressComponents']) {
	if (!addressComponents) {
		return;
	}

	return getadressComponent(addressComponents, 'route', 'longText');
}

function initMap() {
	if (!mapContainer.value) {
		return;
	}

	map = new mapsLibrary.Map(mapContainer.value, {
		center: { lat: 0, lng: 0 },
		zoom: 1,
		keyboardShortcuts: false,
		disableDefaultUI: true,
		mapId: 'DEMO_MAP_ID', // a map ID is required for the new AdvancedMarker, the demo ID is provided by google, @see https://developers.google.com/maps/documentation/javascript/advanced-markers/migration?hl=en
	});

	map.addListener('tilesloaded', () => {
		if (searchContainer.value) {
			map.controls[google.maps.ControlPosition.TOP_LEFT].push(searchContainer.value);
		}

		if (mapControlsContainer.value) {
			map.controls[google.maps.ControlPosition.LEFT_CENTER].push(mapControlsContainer.value);
		}

		if (mapTypeSelectContainer.value) {
			map.controls[google.maps.ControlPosition.TOP_RIGHT].push(mapTypeSelectContainer.value);
		}

		// Wait to make sure the controls are ready, this prevents a layout shift
		setTimeout(() => {
			controlsReady.value = true;
		}, 75);
	});

	setMapValue();
}

function setMapValue() {
	if (!props.value) {
		return;
	}

	const { geometry, properties } = props.value;

	if (geometry?.coordinates?.[1] !== undefined && geometry?.coordinates?.[0] !== undefined) {
		setMapLocation(new google.maps.LatLng(geometry.coordinates[1], geometry.coordinates[0]), properties?.viewport);
	}

	if (properties?.displayName) {
		searchInput.value = properties.displayName;
	}
}

function setMapLocation(location: google.maps.LatLng, viewPort: google.maps.LatLngBounds | null | undefined) {
	if (!map) {
		return;
	}

	_setMapCenter(location, viewPort);
	_setMapMarker(location);
}

function _setMapCenter(location: google.maps.LatLng, viewPort: google.maps.LatLngBounds | null | undefined) {
	map.setCenter(location);

	if (viewPort) {
		map.fitBounds(viewPort);
	}
	else {
		// Create bounds with some padding around the point
		const bounds = new google.maps.LatLngBounds();
		bounds.extend(location);

		const PADDING = 0.01;
		bounds.extend(new google.maps.LatLng(location.lat() + PADDING, location.lng() + PADDING));
		bounds.extend(new google.maps.LatLng(location.lat() - PADDING, location.lng() - PADDING));

		map.fitBounds(bounds);
	}
}

function _setMapMarker(location: google.maps.LatLng) {
	if (marker) {
		marker.map = null;
	}

	removeMarkerDragEndListener();

	marker = new markerLibrary.AdvancedMarkerElement({
		position: location,
		map,
	});

	setMarkerDraggableBehavior(marker);
}

function setMarkerDraggableBehavior(currentMarker: google.maps.marker.AdvancedMarkerElement) {
	const isDraggable = props.displayMap && props.markerDraggable && !props.disabled;
	const markerWithDragToggle = currentMarker as google.maps.marker.AdvancedMarkerElement & { gmpDraggable?: boolean };

	markerWithDragToggle.gmpDraggable = isDraggable;
	removeMarkerDragEndListener();

	if (!isDraggable) {
		return;
	}

	markerDragEndListener = currentMarker.addListener('dragend', onMarkerDragEnd);
}

function onMarkerDragEnd() {
	if (!marker?.position) {
		return;
	}

	const coordinates = getCoordinatesFromMarkerPosition(marker.position);

	if (!coordinates) {
		return;
	}

	const properties = { ...(props.value?.properties ?? {}) } as Partial<GeoProperties>;
	delete properties.viewport;
	const city = properties.city ?? selectedCity.value ?? null;
	const address = properties.street ?? selectedAddress.value ?? null;

	if (city) {
		properties.city = city;
		selectedCity.value = city;
	}

	if (address) {
		properties.street = address;
		selectedAddress.value = address;
	}

	emit('input', {
		geometry: {
			coordinates,
			type: 'Point',
		},
		properties,
		type: 'Feature',
	});

	setMappedFields(coordinates[1], coordinates[0], city, address);
}

async function setMappedFields(lat: number, lng: number, city: string | null, address: string | null) {
	const updates: Array<[field: string, value: MappedFieldValue]> = [];

	if (props.latField) {
		updates.push([props.latField, lat]);
	}

	if (props.lngField) {
		updates.push([props.lngField, lng]);
	}

	if (props.cityField) {
		updates.push([props.cityField, city]);
	}

	if (props.addressField) {
		updates.push([props.addressField, address]);
	}

	if (updates.length === 0) {
		return;
	}

	// Keep local form state in sync first so both values exist before event handlers run.
	if (values?.value) {
		for (const [field, value] of updates) {
			values.value[field] = value;
		}
	}

	// Emit sequentially across ticks to avoid dropping the first sibling field update.
	for (const [field, value] of updates) {
		emitFieldValue(field, value);
		await nextTick();
	}
}

function emitFieldValue(field: string, value: MappedFieldValue) {
	emit('setFieldValue', field, value);
	emit('setFieldValue', { field, value });
	emit('set-field-value', { field, value });
}

function getCoordinatesFromMarkerPosition(position: google.maps.LatLng | google.maps.LatLngLiteral): Coordinates | null {
	if (position instanceof google.maps.LatLng) {
		return [position.lng(), position.lat()];
	}

	if (typeof position.lat === 'number' && typeof position.lng === 'number') {
		return [position.lng, position.lat];
	}

	return null;
}

function removeMarkerDragEndListener() {
	if (!markerDragEndListener) {
		return;
	}

	markerDragEndListener.remove();
	markerDragEndListener = null;
}

function zoomMap(zoomValue: number) {
	map.setZoom(map.getZoom()! + zoomValue);
}

function toggleFullscreen() {
	if (!mapContainer.value?.requestFullscreen || !document.exitFullscreen) {
		return;
	}

	if (isFullscreen.value) {
		document.exitFullscreen();
		isFullscreen.value = false;
		return;
	}

	mapContainer.value.requestFullscreen();
	isFullscreen.value = true;
}

function setMapType(newValue: MapType) {
	mapType.value = newValue;
	map.setMapTypeId(google.maps.MapTypeId[newValue.toUpperCase()]);
}
</script>

<template>
	<template v-if="!props.apiKeyGMaps">
		<VNotice type="warning">
			Please provide a valid Google Maps API key in the interface settings to use this component.
		</VNotice>
	</template>

	<template v-else>
		<!-- Render map first, to reduce content-shift on moving the search-input into the map -->
		<div v-if="props.displayMap">
			<div ref="mapContainer" class="map-container" />

			<div v-show="controlsReady" ref="mapTypeSelectContainer" class="map-type-select-container">
				<VSelect
					class="small"
					:model-value="mapType"
					:items="[
						{
							text: 'Map',
							value: 'roadmap',
						},
						{
							text: 'Satellite',
							value: 'satellite',
						},
						{
							text: 'Hybrid',
							value: 'hybrid',
						},
						{
							text: 'Terrain',
							value: 'terrain',
						},
					]"
					close-on-content-click
					@update:model-value="(newValue) => setMapType(newValue)"
				/>
			</div>

			<div v-show="controlsReady" ref="mapControlsContainer" class="map-controls-container">
				<VButton
					icon
					small
					secondary
					:tooltip="t('zoom')"
					@click="zoomMap(1)"
				>
					<v-icon name="add" />
				</VButton>

				<VButton
					icon
					small
					secondary
					:tooltip="t('zoom')"
					@click="zoomMap(-1)"
				>
					<v-icon name="remove" />
				</VButton>

				<VButton
					icon
					small
					secondary
					class="map-controls-fullscreen"
					:tooltip="t('wysiwyg_options.fullscreen')"
					@click="toggleFullscreen"
				>
					<v-icon :name="isFullscreen ? 'fullscreen_exit' : 'fullscreen'" />
				</VButton>
			</div>
		</div>

		<div v-show="mapContainer && controlsReady || !mapContainer" ref="searchContainer" class="search-container">
			<v-menu attached :disabled="disabled">
				<template #activator="{ activate }">
					<v-input
						:placeholder="t('search')"
						:model-value="searchInput"
						:disabled="disabled"
						:small="props.displayMap ? true : false"
						@update:model-value="onInput"
						@focus="activate"
					>
						<template v-if="iconLeft" #prepend>
							<v-icon :name="iconLeft" />
						</template>

						<template v-if="iconRight" #append>
							<v-icon :name="iconRight" />
						</template>
					</v-input>
				</template>

				<v-list v-if="results.length > 0">
					<v-list-item
						v-for="result of results"
						:key="result.placeId"
						:class="selectedPlaceId === result.placeId ? 'selected' : ''"
						@click="() => onPlaceSelected(result)"
					>
						{{ result.text }}
					</v-list-item>

					<!--
						If we do not display the map, we need to include the google logo in here
						@see https://developers.google.com/maps/documentation/javascript/place-autocomplete-data
						@see https://developers.google.com/maps/documentation/javascript/policies#logo
					-->
					<v-list-item
						v-if="!props.displayMap"
						:clickable="false"
						disabled
						class="google-logo"
					>
						<img :src="isDark ? googleLogoDark : googleLogo" alt="Google Logo">
					</v-list-item>
				</v-list>
			</v-menu>
		</div>
	</template>
</template>

<style lang="scss" scoped>
:deep(.v-select) {
	/*
	Small style in sync with input-small
	@see https://github.com/directus/directus/blob/28aaf739ba75980f4cb5ed1fa8c31b900dd97765/app/src/components/v-input.vue#L434-L440
	*/
	&.small {
		.v-input {
			height: 38px;

			.input {
				padding: 8px 12px;
			}
		}
	}
}

:deep(.v-button.secondary) {
	button {
		background-color: var(--theme--form--field--input--background);
	}
}

.v-list {
	.v-list-item {
		&.selected,
		&:hover {
			background-color: var(
				--v-list-item-background-color-active,
				var(--v-list-background-color-active, var(--theme--background-normal))
			);
		}

		&.google-logo {
			&:hover {
				background-color: transparent;
			}

			img {
				height: 1.25rem;
			}
		}
	}
}

.map-container {
	height: 500px;
	width: 100%;
	border: var(--theme--border-width) solid var(--theme--form--field--input--border-color);
	border-radius: var(--theme--border-radius);

	.search-container,
	.map-type-select-container,
	.map-controls-container {
		margin: 10px;
		font-size: 15px; /* Align with the #main-content base font-size */
	}

	.search-container {
		width: calc(70% - 20px);
		left: 0 !important;
	}

	.map-type-select-container {
		width: calc(30% - 20px);
		right: 0 !important;
	}

	.map-controls-container {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		left: 0 !important;
		top: 60px !important;

		.map-controls-fullscreen {
			margin-top: 1rem;
		}
	}
}
</style>
