# References

## Official Chrome Documentation

- Manifest file format: https://developer.chrome.com/docs/extensions/reference/manifest
- Manifest `short_name`: https://developer.chrome.com/docs/extensions/reference/manifest/short-name
- Declare permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Permissions list: https://developer.chrome.com/docs/extensions/reference/permissions-list
- Side Panel API: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- Bookmarks API: https://developer.chrome.com/docs/extensions/reference/api/bookmarks
- Storage API: https://developer.chrome.com/docs/extensions/reference/api/storage
- Fetching favicons in MV3: https://developer.chrome.com/docs/extensions/how-to/ui/favicons
- Chrome extension samples: https://developer.chrome.com/docs/extensions/samples

## Relevant Samples And Projects

- GoogleChrome chrome-extensions-samples: https://github.com/GoogleChrome/chrome-extensions-samples
- Side panel open sample: https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/cookbook.sidepanel-open
- Dictionary side panel sample: https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/sample.sidepanel-dictionary
- TagDown bookmark manager: https://github.com/Benbinbin/TagDown

## Notes

The important architectural guidance for WideMark is:

- Keep the service worker small.
- Keep side panel UI code inside the extension page.
- Keep bookmark management tied to the Chrome Bookmarks API.
- Avoid website host permissions unless a feature truly requires website access.
