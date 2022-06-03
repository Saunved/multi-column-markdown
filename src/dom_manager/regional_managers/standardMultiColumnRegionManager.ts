/**
 * File: /src/dom_manager/regional_managers/regionDOMManager.ts                *
 * Created Date: Sunday, May 22nd 2022, 7:46 pm                                *
 * Author: Cameron Robinson                                                    *
 *                                                                             *
 * Copyright (c) 2022 Cameron Robinson                                         *
 */

import { DOMObject, DOMObjectTag, TaskListDOMObject } from '../domObject';
import { MultiColumnSettings, ColumnLayout } from "../../regionSettings";
import { MultiColumnLayoutCSS, MultiColumnStyleCSS } from '../../utilities/cssDefinitions';
import { MarkdownRenderChild } from 'obsidian';
import { RegionManager } from './regionManager';

export class StandardMultiColumnRegionManager extends RegionManager {


    public renderRegionElementsToScreen(): void {

        this.renderColumnMarkdown(this.regionParent, this.domList, this.regionalSettings);
    }
    public exportRegionElementsToPDF(pdfParentElement: HTMLElement): void {

        // Default set shadow to off for exporting PDFs
        let renderSettings = this.regionalSettings;
        renderSettings.drawShadow = false;
        this.renderColumnMarkdown(pdfParentElement, this.domList.slice(), renderSettings);
    }

    /**
     * This function takes in the data for the multi-column region and sets up the 
     * user defined number of children with the proper css classes to be rendered properly.
     * 
     * @param parentElement The element that the multi-column region will be rendered under.
     * @param regionElements The list of DOM objects that will be coppied under the parent object
     * @param settings The settings the user has defined for the region.
     */
    private renderColumnMarkdown(parentElement: HTMLElement, regionElements: DOMObject[], settings: MultiColumnSettings) {

        let multiColumnParent = createDiv({
            cls: MultiColumnLayoutCSS.RegionColumnContainerDiv,
        });


        /**
         * Pass our parent div and settings to parser to create the required
         * column divs as children of the parent.
         */
        let columnContentDivs = this.getColumnContentDivs(settings, multiColumnParent);
        if(settings.drawShadow === true) {
            multiColumnParent.addClass(MultiColumnStyleCSS.RegionShadow);
        }
        for(let i = 0; i < columnContentDivs.length; i++) {
            if(settings.drawBorder === true) {
                columnContentDivs[i].addClass(MultiColumnStyleCSS.ColumnBorder);
            }

            if(settings.drawShadow === true) {
                columnContentDivs[i].addClass(MultiColumnStyleCSS.ColumnShadow);
            }
        }

        // Create markdown renderer to parse the passed markdown
        // between the tags.
        let markdownRenderChild = new MarkdownRenderChild(
            multiColumnParent
        );

        // Remove every other child from the parent so 
        // we dont end up with multiple sets of data. This should
        // really only need to loop once for i = 0 but loop just
        // in case.
        for(let i = parentElement.children.length - 1; i >= 0; i--) {
            parentElement.children[i].detach();
        }
        parentElement.appendChild(markdownRenderChild.containerEl);

        this.appendElementsToColumns(regionElements, columnContentDivs, settings);
    }

    private appendElementsToColumns(regionElements: DOMObject[], columnContentDivs: HTMLDivElement[], settings: MultiColumnSettings) {

        let columnIndex = 0;
        for (let i = 0; i < regionElements.length; i++) {

            if (regionElements[i].tag !== DOMObjectTag.startRegion ||
                regionElements[i].tag !== DOMObjectTag.regionSettings ||
                regionElements[i].tag !== DOMObjectTag.endRegion ||
                regionElements[i].tag !== DOMObjectTag.columnBreak) {

                // We store the elements in a wrapper container until we determine
                let element = createDiv({
                    cls: MultiColumnLayoutCSS.ColumnDualElementContainer,
                });
                regionElements[i].elementContainer = element;

                // Otherwise we just make a copy of the original element to display.
                let clonedElement = regionElements[i].originalElement.cloneNode(true) as HTMLDivElement;
                regionElements[i].clonedElement = clonedElement;
                element.appendChild(clonedElement);

                if (regionElements[i] instanceof TaskListDOMObject) {

                    this.fixClonedCheckListButtons(regionElements[i] as TaskListDOMObject, true);
                }

                if (element !== null) {

                    columnContentDivs[columnIndex].appendChild(element);
                }

                /**
                 * If the tag is a column break we update the column index after
                 * appending the item to the column div. This keeps the main DOM
                 * cleaner by removing other items and placing them all within
                 * a region container.
                 */
                if (regionElements[i].tag === DOMObjectTag.columnBreak &&
                    (columnIndex + 1) < settings.numberOfColumns) {

                    columnIndex++;
                }
            }
        }
    }
}

