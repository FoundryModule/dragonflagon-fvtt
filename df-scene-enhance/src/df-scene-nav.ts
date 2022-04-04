import SETTINGS from "../../common/Settings";

export default class DFSceneNav {
	static ON_CLICK = 'nav-on-click';
	static ON_CLICK_PLAYER = 'nav-on-click-player';

	static patchSceneDirectoryClick(newValue?: boolean, isPlayer?: boolean) {
		let gmClick = SETTINGS.get(DFSceneNav.ON_CLICK);
		let pcClick = SETTINGS.get(DFSceneNav.ON_CLICK_PLAYER);
		if (newValue !== undefined) {
			if (isPlayer) pcClick = newValue;
			else gmClick = newValue;
		}

		// Determine our enabled state
		const enabled = (game.user.isGM && gmClick) || (!game.user.isGM && pcClick);
		if (enabled) {
			libWrapper.register(SETTINGS.MOD_NAME, 'SceneDirectory.prototype._onClickDocumentName', this._onClickDocumentName, 'MIXED');
			libWrapper.register(SETTINGS.MOD_NAME, 'SceneDirectory.prototype._getEntryContextOptions', this._getEntryContextOptions, 'MIXED');
		} else {
			libWrapper.unregister(SETTINGS.MOD_NAME, 'SceneDirectory.prototype._onClickDocumentName', false);
			libWrapper.unregister(SETTINGS.MOD_NAME, 'SceneDirectory.prototype._getEntryContextOptions', false);
		}
	}

	private static _onClickDocumentName(this: SceneDirectory, wrapper: AnyFunction, event: JQuery.ClickEvent) {
		event.preventDefault();
		const entity = SceneDirectory.collection.get(event.currentTarget.parentElement.dataset.documentId);
		if (entity instanceof Scene) entity.view();
		else wrapper(event);
	}

	private static _getEntryContextOptions(wrapper: AnyFunction, ...args: any) {
		if (game.user.isGM) return wrapper(...args);
		else return [{
			name: "SCENES.View",
			icon: '<i class="fas fa-eye"></i>',
			condition: (li: JQuery<HTMLLIElement>) => !canvas.ready || (li.data("entityId") !== (canvas as Canvas).scene.id),
			callback: (li: JQuery<HTMLLIElement>) => {
				const scene = game.scenes.get(li.data("entityId"));
				scene.view();
			}
		}];
	}

	static patchSceneDirectory() {
		// const sidebarDirDefOpts = Object.getOwnPropertyDescriptor(SidebarDirectory, 'defaultOptions');
		const defaultOptions = duplicate(SceneDirectory.defaultOptions);
		Object.defineProperty(SceneDirectory, 'defaultOptions', {
			get: function () {
				const options = mergeObject(defaultOptions, {
					template: `modules/${SETTINGS.MOD_NAME}/templates/scene-directory.hbs`,
				});
				return options;
			}
		});
	}

	static patchSidebar() {
		libWrapper.register(SETTINGS.MOD_NAME, 'Sidebar.prototype._render', async function (this: Sidebar, wrapper: AnyFunction, force: boolean, options = {}) {
			if (!SETTINGS.get(DFSceneNav.ON_CLICK_PLAYER))
				return wrapper(force, options);
			/************** COPIED FROM Sidebar.prototype._render *************/
			// Render the Sidebar container only once
			// @ts-expect-error
			if (!this.rendered) await Application.prototype._render.apply(this, [force, options]);

			// Define the sidebar tab names to render
			const tabs = ["chat", "combat", "actors", "items", "journal", "tables", "cards", "playlists", "compendium", "settings"];
			if (game.user.isGM || SETTINGS.get(DFSceneNav.ON_CLICK_PLAYER)) tabs.push("scenes");

			// Render sidebar Applications
			for (const [name, app] of Object.entries(this.tabs)) {
				// @ts-expect-error
				app._render(true).catch(err => {
					// @ts-expect-error
					Hooks.onError("Sidebar#_render", err, {
						msg: `Failed to render Sidebar tab ${name}`,
						log: "error",
						name
					});
				});
			}
			/******************************************************************/
		}, 'MIXED');
		libWrapper.register(SETTINGS.MOD_NAME, 'SceneDirectory.prototype._render', async function (this: SceneDirectory, wrapper: AnyFunction, ...args: any) {
			if (!SETTINGS.get(DFSceneNav.ON_CLICK_PLAYER)) return wrapper(...args);
			// @ts-expect-error
			return SidebarDirectory.prototype._render.apply(this, <any>[...args]);
		}, 'MIXED');
		libWrapper.register(SETTINGS.MOD_NAME, 'Sidebar.prototype.getData', (wrapper: (options: any) => Sidebar.Data, options: any) => {
			return mergeObject(wrapper(options), { scenesAllowed: game.user.isGM || SETTINGS.get(DFSceneNav.ON_CLICK_PLAYER) });
		}, 'WRAPPER');
		const sidebarDefaultOptions = Object.getOwnPropertyDescriptor(Sidebar, 'defaultOptions');
		Object.defineProperty(Sidebar, 'defaultOptions', {
			get: function () {
				return mergeObject(sidebarDefaultOptions.get(), {
					template: `modules/${SETTINGS.MOD_NAME}/templates/sidebar.hbs`
				});
			}
		});
	}
	static init() {
		SETTINGS.register(DFSceneNav.ON_CLICK, {
			name: "DF-SCENE-ENHANCE.Nav_SettingOnClick",
			hint: "DF-SCENE-ENHANCE.Nav_SettingOnClickHint",
			scope: "world",
			config: true,
			type: Boolean,
			default: true,
			onChange: (value: boolean) => DFSceneNav.patchSceneDirectoryClick(value, false)
		});
		SETTINGS.register(DFSceneNav.ON_CLICK_PLAYER, {
			name: "DF-SCENE-ENHANCE.Nav_SettingOnClickPC",
			hint: "DF-SCENE-ENHANCE.Nav_SettingOnClickPCHint",
			scope: "world",
			config: true,
			type: Boolean,
			default: true,
			onChange: (value: boolean) => DFSceneNav.patchSceneDirectoryClick(value, true)
		});

		Handlebars.registerHelper('dfCheck', function (scene) {
			return ((game.user && game.user.isGM) || !scene.data.navName) ? scene.data.name : scene.data.navName;
		});

		DFSceneNav.patchSceneDirectory();
		DFSceneNav.patchSidebar();
	}

	static ready() {
		DFSceneNav.patchSceneDirectoryClick();
	}
}
