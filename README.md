# Address Completion Interface for Directus
A Directus interface that integrates Google Maps address autocompletion functionality into the Directus Editor.

## Fork Notice
This repository is a fork of:
https://github.com/directus-labs/extensions/tree/main/packages/address-completion-interface

The upstream package is MIT licensed, and this fork keeps the same license terms.

![](https://raw.githubusercontent.com/directus-labs/extensions/main/packages/address-completion-interface/docs/interface.png)

## Features
- Google Maps address autocompletion
- Customizable autocompletion configuration
- Display the result on a map (optionally)
- Optional marker dragging to fine-tune the selected location

## Prerequisites
- A Directus installation
- Google Maps API key with appropriate permissions
- Access to your Directus environment variables

## Installation
You can install this fork directly into your Directus project `extensions` folder.

```bash
cd /path/to/your/directus/extensions
git clone <your-fork-repo-url> address-completion-interface
cd address-completion-interface
npm install
npm run build
```

Then restart Directus so the new build is loaded.

If you update this repository later, run:

```bash
git pull
npm install
npm run build
```

And restart Directus again.

For general extension loading behavior, see the [Official Guide](https://docs.directus.io/extensions/installing-extensions.html).

## Configuration
### 1. Environment Variables
Add the following environment variables to your config file, in order to allow the app to load data from the google-APIs:

```env
CONTENT_SECURITY_POLICY_DIRECTIVES__SCRIPT_SRC=array:'self','unsafe-eval',https://*.googleapis.com
CONTENT_SECURITY_POLICY_DIRECTIVES__IMG_SRC=array:'self',data:,blob:,https://*.gstatic.com,https://*.googleapis.com
CONTENT_SECURITY_POLICY_DIRECTIVES__CONNECT_SRC=array:'self',https://*.googleapis.com,https://*.google.com
CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC=array:'self',https://*.google.com,https://*.googleapis.com
```

### 2. Google Maps API Setup
1. Obtain a Google Maps API key from the Google Cloud Console. View [Google documentation](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
2. Enable the following APIs in your Google Cloud project:
   - Places API (New)
   - Maps JavaScript API

**Recommended Security Measures:**

- Restrict the API key to your domain
- Enable only the required services (Places API and Maps JavaScript API)

## Interface Configuration
![](https://raw.githubusercontent.com/directus-labs/extensions/main/packages/address-completion-interface/docs/settings.png)

### Autocomplete Settings
You can customize the autocomplete behavior using the interface settings. The configuration accepts standard Google Places Autocomplete parameters as documented in the [Google Maps JavaScript API Reference](https://developers.google.com/maps/documentation/javascript/reference/autocomplete-data#AutocompleteRequest.includedRegionCodes).

Example Configuration:

```json
{
    "includedRegionCodes": [
        "us"
    ]
}
```
This example restricts autocomplete results to US addresses only.

### Marker Dragging
Enable `Enable marker dragging` in the interface settings to allow users to reposition the marker manually after selecting an address. Disable it to keep marker placement fixed.

### Populate Latitude/Longitude Fields
Use `Latitude field key` and `Longitude field key` to write coordinates into other fields in the same item (defaults are `lat` and `lng`).
These fields are updated when an address is selected and also when the marker is dragged.

### Populate City Field
Use `City field key` to write the detected city/locality into another field in the same item (default: `city`).
City is extracted from address components with this fallback order:
`locality` -> `postal_town` -> `administrative_area_level_3` -> `administrative_area_level_2`.

## Admin Setup
1. Create a JSON field for the GeoJSON output (this is the field that uses this interface).
2. Create numeric fields for coordinates (for example `lat` and `lng`) and a text field for city (for example `city`).
3. In the JSON field interface settings:
   - Set `Google Maps API Key`
   - Optionally configure `Autocomplete Fetch Options`
   - Set `Latitude field key` to your latitude field key (example: `lat`)
   - Set `Longitude field key` to your longitude field key (example: `lng`)
   - Set `City field key` to your city field key (example: `city`)
   - Optionally enable `Enable marker dragging`
4. Save an item by selecting an address or dragging the marker.

On save/input updates:
- The GeoJSON field is updated with full geometry/properties.
- The configured latitude/longitude fields are updated with coordinates.
- The configured city field is updated from place address components.

## Changes In This Fork
- Added support for writing coordinates into separate item fields (`lat` / `lng` by default).
- Added support for writing city/locality into a separate item field (`city` by default).
- Added interface settings for mapping target coordinate field keys.
- Added interface setting for mapping the target city field key.
- Added marker-drag coordinate sync for those fields.

### Support
For issues and feature requests, please use the GitHub issues section of this repository.
