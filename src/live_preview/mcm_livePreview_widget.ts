/*
 * Filename: multi-column-markdown/src/live_preview/MultiColumnMarkdown_Widget.ts
 * Created Date: Tuesday, August 16th 2022, 4:38:43 pm
 * Author: Cameron Robinson
 * 
 * Copyright (c) 2022 Cameron Robinson
 */

import { MarkdownRenderChild, MarkdownRenderer, TFile, WorkspaceLeaf } from "obsidian";
import { WidgetType } from "@codemirror/view";
import { getDefaultMultiColumnSettings, MultiColumnSettings } from "../regionSettings";
import { findSettingsCodeblock, findStartCodeblock } from "../utilities/textParser";
import { parseColumnSettings, parseSingleColumnSettings } from "../utilities/settingsParser";
import { StandardMultiColumnRegionManager } from "../dom_manager/regional_managers/standardMultiColumnRegionManager";
import { RegionManagerData } from "../dom_manager/regional_managers/regionManagerContainer";
import { getUID } from "../utilities/utils";
import { DOMObject } from "../dom_manager/domObject";
import { RegionManager } from "../dom_manager/regional_managers/regionManager";
import { SingleColumnRegionManager } from "../dom_manager/regional_managers/singleColumnRegionManager";
import { AutoLayoutRegionManager } from "../dom_manager/regional_managers/autoLayoutRegionManager";

export class MultiColumnMarkdown_LivePreview_Widget extends WidgetType {

    contentData: string;
    tempParent: HTMLDivElement;
    domList: DOMObject[] = [];
    settingsText: string;
    regionSettings: MultiColumnSettings = getDefaultMultiColumnSettings();
    regionManager: RegionManager;

    constructor(contentData: string) {
        super();
        this.contentData = contentData;

        // Find the settings defined in the content, if it exists.
        // If the settings codeblock isnt defined attempt to get the region codeblock type.
        let settingsStartData = findSettingsCodeblock(this.contentData);
        if(settingsStartData.found === false) {
            settingsStartData = findStartCodeblock(this.contentData);
        }
        if (settingsStartData.found === true) {

            this.settingsText = this.contentData.slice(settingsStartData.startPosition, settingsStartData.endPosition);
            this.contentData = this.contentData.replace(this.settingsText, "");

            // Parse the settings, updating the default settings.
            this.regionSettings = parseColumnSettings(this.settingsText);
        }

        // Render the markdown content to our temp parent element.
        this.tempParent = createDiv();
        let elementMarkdownRenderer = new MarkdownRenderChild(this.tempParent);
        MarkdownRenderer.renderMarkdown(this.contentData, this.tempParent, "", elementMarkdownRenderer);

        // take all elements, in order, and create our DOM list.
        let arr = Array.from(this.tempParent.children);
        for (let i = 0; i < arr.length; i++) {

            let el = this.fixElementRender(arr[i]);
            this.domList.push(new DOMObject(el as HTMLElement, [""]));
        }

        // Set up the region manager data before then creating our region manager.
        let regionData: RegionManagerData = {
            domList: this.domList,
            domObjectMap: new Map<string, DOMObject>(),
            regionParent: createDiv(),
            fileManager: null,
            regionalSettings: this.regionSettings,
            regionKey: getUID(),
            rootElement: createDiv()
        };

        // Finally setup the type of region manager required.
        if (this.regionSettings.numberOfColumns === 1) {
            this.regionSettings = parseSingleColumnSettings(this.settingsText, this.regionSettings);
            this.regionManager = new SingleColumnRegionManager(regionData);
        }
        else if (this.regionSettings.autoLayout === true) {
            this.regionManager = new AutoLayoutRegionManager(regionData);
        }
        else {
            this.regionManager = new StandardMultiColumnRegionManager(regionData);
        }
    }

    fixElementRender(el: Element): Element {

        let fixedEl = fixImageRender(el);
        return fixedEl;
    }

    toDOM() {
        // Create our element to hold all of the live preview elements.
        let el = document.createElement("div");
        el.className = "mcm-cm-preview";

        /**
         * For situations where we need to know the rendered height, AutoLayout, 
         * the element must be rendered onto the screen to get the info, even if 
         * only for a moment. Here we attempt to get a leaf from the app so we 
         * can briefly append our element, check any data if required, and then
         * remove it.
         */
        let leaf: WorkspaceLeaf = null;
        if (app) {
            let leaves = app.workspace.getLeavesOfType("markdown");
            if (leaves.length > 0) {
                leaf = leaves[0];
            }
        }

        if (this.regionManager) {

            if (leaf) {
                leaf.view.containerEl.appendChild(el);
            }

            this.regionManager.renderRegionElementsToLivePreview(el);

            if (leaf) {
                leaf.view.containerEl.removeChild(el);
            }
        }

        fixExternalLinks(el)

        return el;
    }
}

export class MultiColumnMarkdown_DefinedSettings_LivePreview_Widget extends WidgetType {

    contentData: string;

    constructor(contentData: string) {
        super();

        this.contentData = contentData;
    }

    toDOM() {
        // Create our element to hold all of the live preview elements.
        let el = document.createElement("div");
        el.className = "mcm-cm-settings-preview";

        let labelDiv = el.createDiv()
        let label = labelDiv.createSpan({
            cls: "mcm-col-settings-preview"
        })
        label.textContent = "Column Settings:";

        let list = el.createEl("ul")
        let lines = this.contentData.split("\n")
        for(let i = 1; i < lines.length - 1; i++) {
            let item = list.createEl("li")
            item.textContent = lines[i]
        }

        return el;
    }
}

function fixImageRender(el: Element): Element {

    let embed = null;
    let fixedEl = el;

    // image embeds can either be a <div class="internal-embed" or <p><div class="internal-embed"
    // depending on the syntax this additional check is to fix false negatives when embed is
    // the first case.
    if(el.hasClass("internal-embed")) {
        embed = el;
    }
    else {

        let items = el.getElementsByClassName("internal-embed");
        if(items.length !== 1) {
            return el;
        }
        embed = items[0];
    }

    let customWidth = embed.attributes.getNamedItem("width")
    let alt = embed.getAttr("alt")
    let src = embed.getAttr("src")
    
    // If the link source is not an image we dont want to make any adjustments.
    if(filenameIsImage(src) === false) {
        return el;
    }

    // Try to find the image file in the vault. This is very inefficient but works for now.
    let aTFiles = app.vault.getAllLoadedFiles()
    let resourcePath = ""
    for(let i = 0; i < aTFiles.length; i++) {

        let abstractFile = aTFiles[i];
        if(abstractFile instanceof TFile === false) {
            continue;
        }
        let file = abstractFile as TFile;

        if(file.name === src && isImageExtension(file.extension) === true) {
            resourcePath = app.vault.getResourcePath(file)
            break;
        }
    }

    // If we found the resource path then we update the element to be a proper image render.
    if(resourcePath !== "") {

        fixedEl = createDiv({
            cls: "internal-embed image-embed is-loaded",
        })
        fixedEl.setAttr("alt", alt);

        let image = fixedEl.createEl("img");
        image.setAttr("src", resourcePath);

        if(customWidth !== null) {

            image.setAttr("width", customWidth.value);
        }
    }

    return fixedEl;
}

function fixExternalLinks(el: Element): Element {

    let items = el.getElementsByClassName("external-link");
    for(let linkEl of Array.from(items)) {

        let link = linkEl as HTMLElement;
        if(link === undefined ||
           link === null ) {
            continue;
        }

        // Remove the href from the link and setup an event listener to open the link in the default browser.
        let href = link.getAttr("href")
        link.removeAttribute("href");

        link.addEventListener("click", (ev) => {

            window.open(href); 
        });
    }

    items = el.getElementsByClassName("internal-link");
    for(let linkEl of Array.from(items)) {

        let link = linkEl as HTMLElement;
        if(link === undefined ||
           link === null ) {
            continue;
        }

        // Removing the href from internal links is all that seems to be required to fix the onclick.
        link.removeAttribute("href");
    }

    return el;
}

function filenameIsImage(filename: string): boolean {

    let parts = filename.split(".");
    if(parts.length <= 1) {
        return false;
    }

    let extension = parts.last();
    return isImageExtension(extension);
}

function isImageExtension(extension: string): boolean {

    extension = extension.toLowerCase();
    switch(extension) {
        case "png":
        case "jpg":
        case "jpeg":
        case "gif":
        case "bmp":
        case "svg":
            return true;
    }
    return false;
}