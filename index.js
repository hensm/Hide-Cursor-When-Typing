"use strict";

const { Cu, Ci }			= require("chrome");

const { browserWindows }	= require("sdk/windows");
const { viewFor }			= require("sdk/view/core");

const window_utils			= require("sdk/window/utils");

Cu.import("resource://gre/modules/ctypes.jsm");


const user32 = ctypes.open("C:\\WINDOWS\\system32\\user32.dll");

const SystemParametersInfo = user32.declare(
		"SystemParametersInfoW",
		ctypes.winapi_abi,
		ctypes.bool,			// return value

		ctypes.unsigned_int,	// uiAction
		ctypes.unsigned_int,	// uiParam
		ctypes.voidptr_t,		// pvParam
		ctypes.unsigned_int);	// fWinIni

const ShowCursor = user32.declare(
		"ShowCursor",
		ctypes.winapi_abi,
		ctypes.int,				// return value
		ctypes.bool);			// bShow


const SPI_GETMOUSEVANISH = 0x1020;



function get_windows (
		type = "navigator:browser",
		params = { includePrivate: true }) {

	return window_utils.windows(type, params);
}



let is_mouse_hidden = false;

function on_keypress (ev) {
	const window = this;

	// stop if pointer is already hidden
	if (is_mouse_hidden) return;

	// stop if key isn't a printable character
	if (ev.which === 0 || ev.ctrlKey || ev.metaKey || ev.altKey) return;


	const result = ctypes.bool();
	SystemParametersInfo(SPI_GETMOUSEVANISH, 0, result.address(), 0);

	// stop if system setting doesn't hide pointer
	if (!result.value) return;


	const utils = window
		.QueryInterface(Ci.nsIInterfaceRequestor)
		.getInterface(Ci.nsIDOMWindowUtils);

	switch (utils.IMEStatus) {
		// don't hide cursor when not text cursor isn't focused normally
		case utils.IME_STATUS_DISABLED:
		case utils.IME_STATUS_PLUGIN:
			return;
	}

	ShowCursor(false);
	is_mouse_hidden = true;

	window.addEventListener("mousemove", function on_mousemove () {
		ShowCursor(true);
		is_mouse_hidden = false;

		window.removeEventListener("mousemove", on_mousemove);
	});
}


function add_hooks (window) {
	window.addEventListener("keypress", on_keypress.bind(window));
}

function remove_hooks (window) {
	window.removeEventListener("keypress", on_keypress.bind(window));
}



function startup () {
	get_windows().forEach(add_hooks)

	browserWindows.on("open", window => {
		add_hooks(viewFor(window));
	});
}

function shutdown () {
	get_windows().forEach(remove_hooks);
	user32.close();
}


exports.main = startup;
exports.onUnload = shutdown;
