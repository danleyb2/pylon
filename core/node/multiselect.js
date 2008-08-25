/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 *
 */

__MULTISELECT__ = 1 << 8;

// #ifdef __WITH_MULTISELECT

/**
 * Baseclass adding (multi) select features to this Component.
 *
 * @constructor
 * @baseclass
 * @author      Ruben Daniels
 * @version     %I%, %G%
 * @since       0.5
 */
jpf.MultiSelect = function(){
    /* ********************************************************************
                                        PROPERTIES
    *********************************************************************/
    var no_event;
    
    this.selected    = null;
    this.__selected  = null;
    this.indicator   = null;
    this.__indicator = null;
    
    var selSmartBinding;
    var valueList    = [];
    var selectedList = [];
    
    this.__regbase = this.__regbase|__MULTISELECT__;
    
    this.autoselect   = true;
    this.selectable   = true;
    this.multiselect  = true;
    this.useindicator = true;
    
    /* ***********************
        Dynamic Properties
    ************************/
    
    //This should be fixed to be more compatible with widget specific implementations
    if (!this.__supportedProperties)
        this.__supportedProperties = ["value"];
    else
        this.__supportedProperties.push("value");
    
    var specificProperSet = this.__handlePropSet;
    this.__handlePropSet = function(prop, value){
        switch (prop) {
            case "value":
                if (!this.bindingRules || !this.XMLRoot) return;
            
                // #ifdef __DEBUG
                if (!this.bindingRules[this.mainBind])
                    throw new Error(1074, jpf.formatErrorString(1074, this, "setValue Method", "Could not find default value bind rule for this control."))
                // #endif
                
                if (jpf.isNot(value))
                    return this.clearSelection(null, no_event);
                
                var xmlNode = this.findXmlNodeByValue(value);
                if (xmlNode)
                    this.select(xmlNode, null, null, null, null, no_event);
                else
                    return this.clearSelection(null, no_event);
                break;
        }
        
        if (specificProperSet)
            specificProperSet(prop, value);
    }
    
    /* ***********************
                ACTIONS
    ************************/
    // #ifdef __WITH_DATABINDING
    
    /**
     * Removes (selected) {@info TraverseNodes "Traverse Node(s)"} from the data of this component.
     *
     * @action
     * @param  {XMLNode}  xmlNode  optional  The XML node to be removed. If none is specified, the current selection is removed.
     * @param  {Boolean}  do_select  optional  true  the next node is selected after removal
     *                                       false  default  the selection is removed
     * @return  {Boolean}  specifies if the removal succeeded
     */
    this.remove = function(xmlNode, do_select){
        if (!xmlNode) xmlNode = valueList;
        if (!xmlNode) return;

        if (!xmlNode.nodeType){
            sel     = xmlNode;
            xmlNode = null;//sel[0];
        }
        var rValue;
        
        if (xmlNode == this.XMLRoot) return false;
        
        // Determine next selection
        if (do_select){
            var i=0, nextNode = xmlNode||this.selected, ln = this.getSelectCount();
            do {
                nextNode = this.getDefaultNext(nextNode);
                i++;
            }
            while (nextNode && this.isSelected(nextNode) && i < ln);
        }
        
        // Remove node(s)
        if (xmlNode && xmlNode.nodeType) {
            // Determine next selection
            rValue = this.executeAction("removeNode", [xmlNode], "remove", xmlNode);
        }
        else {
            if (this.actionRules && this.actionRules["RemoveGroup"])
                rValue = this.executeAction("removeNodeList", [sel],
                    "removegroup", sel);
            else {
                for (var i=0;i<sel.length;i++) {
                    this.executeAction("removeNode", [sel[i]], "remove", sel[i]);
                    //var rValue = 
                    //if(rValue === false) return false;
                }
            }
        }
        
        //Fix selection if needed
        for (var lst = [], i = 0; i < valueList.length; i++)
            if (valueList[i].parentNode)
                lst.push(valueList[i]);
        
        valueList = lst;
        
        if (do_select) {
            if(nextNode && rValue !== false) this.select(nextNode);
        }
        else {
            if (valueList.length)
                this.setIndicator(valueList[0]);
            else {
                var xmlNode = this.getFirstTraverseNode();
                if (xmlNode)
                    this.setIndicator(xmlNode);
            }
        }
        
        return rValue;
    }
    
    /**
     * @alias  #remove
     */
    this.removeGroup = this.remove;
    
    /**
     * Adds a new {@info TraverseNodes "Traverse Node(s)"} to the data of this component.
     *
     * @action
     * @param  {XMLNode}  xmlNode  optional  the XML node to be added. If none is specified the action will use the action rule to get the XML node to add.
     * @param  {XMLNode}  beforeNode  optional  the XML node before which <code>xmlNode</code> is inserted.
     * @param  {XMLNode}  pNode  optional  the XML node to which the <code>xmlNode</code> is added as a child.
     * @return  {Boolean}  specifies if the removal succeeded
     */
    this.add = function(xmlNode, beforeNode, pNode){
        var node = this.actionRules && this.actionRules["add"] ? this.actionRules["add"][0] : null;
        //if (!node)
            //throw new Error(0, jpf.formatErrorString(0, this, "Add Action", "Could not find Add Node"));
        
        //#ifdef __WITH_OFFLINE
        if(!jpf.offline.canTransact())
            return false;
        //#endif
        
        var jmlNode  = this; //PROCINSTR
        var callback = function(addXmlNode, state, extra){
            if (state != __HTTP_SUCCESS__){
                if (state == __HTTP_TIMEOUT__ && extra.retries < jpf.maxHttpRetries)
                    return extra.tpModule.retry(extra.id);
                else {
                    var commError = new Error(1032, jpf.formatErrorString(1032, jmlNode, "Loading xml data", "Could not add data for control " + jmlNode.name + "[" + jmlNode.tagName + "] \nUrl: " + extra.url + "\nInfo: " + extra.message + "\n\n" + xmlNode));
                    if (jmlNode.dispatchEvent("onerror", jpf.extend({
                        error   : commError,
                        state   : status
                    }, extra)) !== false)
                        throw commError;
                    return;
                }
            }
            
            if (typeof addXmlNode != "object")
                addXmlNode = jpf.getObject("XMLDOM", addXmlNode).documentElement;
            if (addXmlNode.getAttribute(jpf.XMLDatabase.xmlIdTag))
                addXmlNode.setAttribute(jpf.XMLDatabase.xmlIdTag, "");
            
            var actionNode = jmlNode.getNodeFromRule("add", jmlNode.isTreeArch
                ? jmlNode.selected
                : jmlNode.XMLRoot, true, true);
            if (!pNode && actionNode && actionNode.getAttribute("parent"))
                pNode = jmlNode.XMLRoot.selectSingleNode(actionNode.getAttribute("parent"));
            
            if (jmlNode.executeAction("appendChildNode", 
              [pNode || jmlNode.XMLRoot, addXmlNode, beforeNode], 
              "add", addXmlNode) !== false && jmlNode.autoselect)
                jmlNode.select(addXmlNode);
                
            return addXmlNode;
        }
        
        if (xmlNode)
            return callback(xmlNode, __HTTP_SUCCESS__);
        else if (node.getAttribute("get"))
            return jpf.getData(node.getAttribute("get"), node, callback)
        else if (node.firstChild)
            return callback(jpf.compat.getNode(node, [0]).cloneNode(true), __HTTP_SUCCESS__);
        
        return addXmlNode;
    }
    
    /* ********************************************************************
                                        PUBLIC METHODS
    *********************************************************************/
    if (!this.setValue) {
        /**
         * Sets the value of this component.
         *
         * @param  {String}  value  required  String specifying the value to set. For components inheriting from MultiSelect a selection will be made based on the j:Value bind rule. If no item is found, the selection will be cleared.
         * @see #getValue
         */
        this.setValue = function(value, disable_event){
            no_event = disable_event;
            this.setProperty("value", value);
            no_event = false;
        }
    }
    
    /**
     * @private
     */
    this.findXmlNodeByValue = function(value){
        var nodes = this.getTraverseNodes();
        for (var i = 0; i < nodes.length; i++) {
            if (this.applyRuleSetOnNode(this.mainBind, nodes[i]) == value) {
                return nodes[i];
            }
        }
    }
    
    if (!this.getValue) {
        /**
         * Gets the value of this component.
         * This is the value that is used for validation of this component.
         *
         * @return  {String}  the value of this component
         * @see #setValue
         */
        this.getValue = function(){
            if (!this.bindingRules) return false;
            
            // #ifdef __DEBUG
            if (!this.bindingRules[this.mainBind])
                throw new Error(1074, jpf.formatErrorString(1074, this, "getValue Method", "Could not find default value bind rule for this control."))
            // #endif
            
            // #ifdef __WITH_MULTIBINDING
            if (!this.multiselect && !this.XMLRoot && selSmartBinding && selSmartBinding.XMLRoot) 
                return selSmartBinding.applyRuleSetOnNode(selSmartBinding.mainBind,
                    selSmartBinding.XMLRoot, null, true);
            // #endif
            
            return this.applyRuleSetOnNode(this.mainBind, this.selected, null, true);
        }
    }
    
    /**
     * Sets the second level SmartBinding for Multilevel Databinding.
     * For more information see {@link MultiLevelBinding}
     *
     * @return  {SmartBinding}  
     * @see #getSelectionBindClass
     */
    this.setSelectionSmartBinding = function(smartbinding, part){
        if (!selSmartBinding)
            selSmartBinding = new jpf.MultiLevelBinding(this);
        selSmartBinding.setSmartBinding(smartbinding, part);
        
        this.dispatchEvent("oninitselbind", {smartbinding : selSmartBinding});
    }
    
    /**
     * Gets the second level SmartBinding for Multilevel Databinding.
     * For more information see {@link MultiLevelBinding}
     *
     * @return  {SmartBinding}  
     * @see #setSelectionBindClass
     */
    this.getSelectionSmartBinding = function(){
        return selSmartBinding;
    }
    
    // #endif
    
    /**
     * Select the current selection again.
     *
     * @todo Add support for multiselect
     */
    this.reselect = function(){
        if (this.selected) this.select(this.selected, null, this.ctrlSelect,
            null, true);//no support for multiselect currently.
    }
    
    var buffered = null;
    /**
     * Selects a single, or set of {@info TraverseNodes "Traverse Nodes"}.
     * The selection can be visually represented in this component.
     *
     * @param  {variant}  xmlNode  required  XMLNode   XML node to be used in the selection as a start/end point or to toggle the selection on the node.
     *                                        HTMLNode  HTML node used as visual representation of data node, to be used to determine the XML node for selection.
     *                                        string    String specifying the value of the {@info TraverseNodes "Traverse Node"} to be selected.
     * @param  {Boolean}  ctrlKey  optional  true  the Ctrl key was pressed
     *                                        false  default  otherwise
     * @param  {Boolean}  shiftKey  optional  true  the Shift key was pressed
     *                                        false  default  otherwise
     * @param  {Boolean}  fakeselect  optional  true  only visually make a selection
     *                                        false  default  otherwise
     * @param  {Boolean}  force  optional  true  force a reselect
     *                                        false  default  otherwise
     * @param  {Boolean}  no_event  optional  true  do not call any events
     *                                        false  default  otherwise
     * @return  {Boolean}  specifying wether the selection could be made
     * @event  onbeforeselect  before a selection is made 
     * @event  onafterselect  after a selection is made
     */
    this.select = function(xmlNode, ctrlKey, shiftKey, fakeselect, force, no_event){
        if (!this.selectable || this.disabled) return;
        
        if (this.ctrlSelect && !shiftKey)
            ctrlKey = true;
        
        // Selection buffering (for async compatibility)
        if (!this.XMLRoot) {
            buffered        = [arguments, this.autoselect];
            this.autoselect = true;
            return;
        }
        
        if (buffered) {
            var x    = buffered;
            buffered = null;
            if (this.autoselect)
                this.autoselect = x[1];
            return this.select.apply(this, x[0]);
        }
        
        var htmlNode;

        /* **** Type Detection *****/
        //if(!this.XMLRoot) throw new Error(0, jpf.formatErrorString(0, this, "select Method", "Cannot select on empty dataset.")); //warning?
        if (!xmlNode)
            throw new Error(1075, jpf.formatErrorString(1075, this, "select Method", "Missing xmlNode reference"))

        if (typeof xmlNode != "object") {
            var str = xmlNode;
            xmlNode = jpf.XMLDatabase.getNodeById(xmlNode);
            
            //Select based on the value of the xml node
            if (!xmlNode) {
                var sel  = str.split("\|");
                var rule = (this.getBindRule("value") || this.getBindRule("caption"));
                if (!rule)
                    throw new Error(0, jpf.formatErrorString(0, this, "select Method", "Could not find rule to select by string with"))
                rule = rule.getAttribute("select");
                
                for (var i = 0; i < (this.multiselect ? 1 : sel.length); i++) {
                    sel[i] = "node()[" + rule + "='" + sel[i].replace(/'/g, "\\'") + "']";
                }
                var xpath = sel.join("\|");
                
                var nodes = this.XMLRoot.selectNodes(xpath);
                for(var i=0;i<nodes.length;i++)
                    this.select(nodes[i]);
                return;
            }
        }
        if (!xmlNode.style)
            htmlNode = this.caching
                ? this.getNodeFromCache(xmlNode.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId)
                : document.getElementById(xmlNode.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId); //IE55
        else {
            var id = (htmlNode = xmlNode).getAttribute(jpf.XMLDatabase.htmlIdTag);
            while (!id && htmlNode.parentNode)
                var id = (htmlNode = htmlNode.parentNode).getAttribute(
                    jpf.XMLDatabase.htmlIdTag);
            
            xmlNode = jpf.XMLDatabase.getNodeById(id, this.XMLRoot);
        }

        if(!no_event && this.dispatchEvent('onbeforeselect', {
            xmlNode : xmlNode,
            htmlNode: htmlNode}) === false)
              return false;

        /* **** Selection *****/
        var lastIndicator = this.indicator;
        this.indicator    = xmlNode;

        //Multiselect with SHIFT Key.
        if (shiftKey && this.multiselect) {
            var range = this.__calcSelectRange(valueList[0] || lastIndicator,
                xmlNode);

            this.selectList(range);
            if (this.__selected)
                this.__deindicate(this.__selected);
            this.__selected = this.__indicate(htmlNode);
        }
        else if (ctrlKey && this.multiselect) { //Multiselect with CTRL Key.
            //Node will be unselected
            if (valueList.contains(xmlNode)) {
                if (!fakeselect) {
                    selectedList.remove(htmlNode);
                    valueList.remove(xmlNode);
                }
                
                if (this.selected == xmlNode) {
                    this.clearSelection(true, true);
                    
                    if (valueList.length && !fakeselect) {
                        //this.__selected = selectedList[0];
                        this.selected = valueList[0];
                    }
                }
                else
                    this.__deselect(htmlNode, xmlNode);
                
                if (this.__selected)
                    this.__deindicate(this.__selected);
                this.__selected = this.__indicate(htmlNode);
                
                if (htmlNode != this.selindicator) {
                    this.__deindicate(this.selindicator);
                    this.selindicator = htmlNode;
                }
            }
            // Node will be selected
            else {
                if (this.selindicator)
                    this.__deindicate(this.selindicator);
                this.__indicate(htmlNode);
                this.selindicator = htmlNode;
                
                if (this.__selected)
                    this.__deindicate(this.__selected);
                this.__selected   = this.__select(htmlNode);
                this.selected     = xmlNode;
            
                if (!fakeselect) {
                    selectedList.push(htmlNode);
                    valueList.push(xmlNode);
                }
            }
        }
        else if (htmlNode && selectedList.contains(htmlNode) && fakeselect) //Return if selected Node is htmlNode during a fake select
            return;
        else { //Normal Selection
            if (!force && htmlNode && this.__selected == htmlNode
              && valueList.length <= 1 && !this.reselectable
              && selectedList.contains(htmlNode))
                return;
            if (this.selected)
                this.clearSelection(null, true);
            if (this.__selected)
                this.__deindicate(this.__selected);

            this.__selected = this.__indicate(htmlNode, xmlNode);
            this.__selected = this.__select(htmlNode, xmlNode);
            this.selected   = xmlNode;
            
            selectedList.push(htmlNode);
            valueList.push(xmlNode);
        }

        if (!no_event) {
            //You could autodetect this by checking how many listeners this component has
            if (this.delayedSelect){ 
                var jNode = this;
                setTimeout(function(){
                    jNode.dispatchEvent("onafterselect", {
                        list    : valueList,
                        xmlNode : xmlNode}
                    );}, 10);
            }
            else
                this.dispatchEvent("onafterselect", {
                    list    : valueList,
                    xmlNode : xmlNode
                });
        }
        
        return true;
    }

    /**
     * Choose a {@info TraverseNodes "Traverse Node"}.
     * The user can do this by either pressing enter or double clicking a selection of this component.
     *
     * @param  {variant}  xmlNode  required  XMLNode   XML node to be choosen.
     *                                        HTMLNode  HTML node used as visual representation of data node, to be used to determine the XML node to be choosen.
     *                                        string    String specifying the value of the {@info TraverseNodes "Traverse Node"} to be choosen.
     * @event  onbeforechoose  before a choice is made 
     * @event  onafterchoose  after a choice is made
     */
    this.choose = function(xmlNode){
        if (!this.selectable || this.disabled) return;
        
        if (this.dispatchEvent("onbeforechoose", {xmlNode : xmlNode}) === false)
            return false;
        
        if (xmlNode && !xmlNode.style)
            this.select(xmlNode);
        
        if (this.hasFeature(__DATABINDING__)
          && this.dispatchEvent("onafterchoose", {xmlNode : this.selected}) !== false)
            this.setConnections(this.selected, "choice");
    }
    
    /**
     * Removes the selection of one or more selected nodes.
     *
     * @param  {Boolean}  singleNode  optional  true  deselect the currently indicated node
     *                                        false  default deselect all selected nodes
     * @param  {Boolean}  no_event  optional  true  do not call any events
     *                                        false  default  otherwise
     * @event  onbeforedeselect  before a choice is made 
     * @event  onafterdeselect   after a choice is made
     */
    this.clearSelection = function(singleNode, no_event){
        if (!this.selectable || this.disabled) return;
        
        var clSel = singleNode ? this.selected : valueList;
        if (!no_event && this.dispatchEvent("onbeforedeselect", {
            xmlNode : clSel
          }) === false)
            return false;
        
        if (this.selected) {
            var htmlNode = this.caching
                ? this.getNodeFromCache(this.selected.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId)
                : document.getElementById(this.selected.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId); //IE55
            this.__deselect(htmlNode);
        }
        
        //if(this.__selected) this.__deselect(this.__selected);
        this.__selected = this.selected = null;
        
        if (!singleNode) {
            for (var i = valueList.length - 1; i >= 0; i--) {
                var htmlNode = this.caching
                    ? this.getNodeFromCache(valueList[i].getAttribute(
                        jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId)
                    : document.getElementById(valueList[i].getAttribute(
                        jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId); //IE55
                this.__deselect(htmlNode);
            }
            //for(var i=selectedList.length-1;i>=0;i--) this.__deselect(selectedList[i]);
            selectedList = [];
            valueList    = [];
        }
        
        if (this.indicator) {
            var htmlNode = this.caching
                ? this.getNodeFromCache(this.indicator.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId)
                : document.getElementById(this.indicator.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId); //IE55
            this.__selected = this.__indicate(htmlNode);
        }
        
        if (!no_event)
            this.dispatchEvent("onafterdeselect", {xmlNode : clSel});
    }
    
    /**
     * Selects a set of nodes
     *
     * @param  {Array}  xmlNodeList  required  Array consisting of XMLNodes or HTMLNodes specifying the selection to be made.
     */
    this.selectList = function(xmlNodeList){
        if (!this.selectable || this.disabled) return;
        this.clearSelection(null, true);

        for (var i=0;i<xmlNodeList.length;i++) {
            if (xmlNodeList[i].nodeType != 1) continue;
            var xmlNode = xmlNodeList[i];

            //Type Detection
            if (typeof xmlNode != "object")
                xmlNode = jpf.XMLDatabase.getNodeById(xmlNode);
            if (!xmlNode.style)
                htmlNode = this.__findNode(null, xmlNode.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId); //IE55
            else {
                htmlNode = xmlNode;
                xmlNode  = jpf.XMLDatabase.getNodeById(htmlNode.getAttribute(
                    jpf.XMLDatabase.htmlIdTag));
            }
            
            if (!xmlNode) {
                // #ifdef __DEBUG
                jpf.issueWarning(0, "Component : " + this.name + " ["
                    + this.tagName + "]\nMessage : xmlNode whilst selecting a list of xmlNodes could not be found. Ignoring.")
                // #endif
                continue;
            }

            //Select Node
            if (htmlNode) {
                this.__select(htmlNode);
                selectedList.push(htmlNode);
            }
            valueList.push(xmlNode);
        }
        
        this.__selected = selectedList[0];
        this.selected   = valueList[0];
    }
    
    /**
     * Sets a {@info TraverseNodes "Traverse Nodes"} as the indicator for this component.
     * The indicator is the position or 'cursor' of the selection. Using the keyboard
     * a user can change the position of the indicator using the Ctrl key and arrows whilst
     * not making a selection. When making a selection with the mouse or keyboard the indicator
     * is always set to the selected node. Unlike a selection there can be only one indicator node.
     *
     * @param  {variant}  xmlNode  required  XMLNode   XML node to be used in the selection as a start/end point or to toggle the selection on the node.
     *                                        HTMLNode  HTML node used as visual representation of data node, to be used to determine the XML node for selection.
     *                                        string    String specifying the value of the {@info TraverseNodes "Traverse Node"} to be selected.
     */
    this.setIndicator = function(xmlNode){
        /* **** Type Detection *****/
        // #ifdef __DEBUG
        if (!xmlNode)
            throw new Error(1075, jpf.formatErrorString(1075, this, "select Method", "Missing xmlNode reference"));
        // #endif

        if (typeof xmlNode != "object")
            xmlNode = jpf.XMLDatabase.getNodeById(xmlNode);
        if (!xmlNode.style)
            htmlNode = this.caching
                ? this.getNodeFromCache(xmlNode.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId)
                : document.getElementById(xmlNode.getAttribute(
                    jpf.XMLDatabase.xmlIdTag) + "|" + this.uniqueId); //IE55
        else {
            var id = (htmlNode = xmlNode).getAttribute(jpf.XMLDatabase.htmlIdTag);
            while (!id && htmlNode.parentNode)
                var id = (htmlNode = htmlNode.parentNode).getAttribute(
                    jpf.XMLDatabase.htmlIdTag);

            xmlNode = jpf.XMLDatabase.getNodeById(id);
        }

        if (this.__selected)
            this.__deindicate(this.__selected);
        this.indicator  = xmlNode;
        this.__selected = this.__indicate(htmlNode);
    }
    
    /**
     * Selects all the {@info TraverseNodes "Traverse Nodes"} of this component
     *
     */
    this.selectAll = function(){
        if (!this.multiselect || !this.selectable
          || this.disabled || !this.__selected)
            return;

        var nodes = this.getTraverseNodes();
        //this.select(nodes[0]);
        //this.select(nodes[nodes.length-1], null, true);
        this.selectList(nodes);
    }
    
    /**
     * Gets an Array or a DocumentFragment containing all the selected {@info TraverseNodes "Traverse Nodes"}
     *
     * @param  {Boolean}  xmldoc  optional  true  method returns a DocumentFragment.
     *                                    false  method returns an Array
     * @return  {variant}  current selection of this component
     */
    this.getSelection = function(xmldoc){
        if (xmldoc) {
            var r = this.XMLRoot
                ? this.XMLRoot.ownerDocument.createDocumentFragment()
                : jpf.getObject("XMLDOM").createDocumentFragment();
            for (var i = 0; i < valueList.length; i++)
                jpf.XMLDatabase.clearConnections(r.appendChild(
                    valueList[i].cloneNode(true)));
        }
        else
            for (var r = [], i = 0; i < valueList.length; i++)
                r.push(valueList[i]);

        return r;
    }
    
    /**
     * @private
     */
    this.getSelectedNodes = function(){
        return valueList;
    }
    
    /**
     * Selectes the next {@info TraverseNodes "Traverse Node"} to be selected from
     * a given Traverse Node.
     *
     * @param  {XMLNode}  xmlNode  required  The 'context' Traverse Node.
     */
    this.defaultSelectNext = function(xmlNode, isTree){
        var next = this.getNextTraverseSelected(xmlNode);
        //if(!next && xmlNode == this.XMLRoot) return;

        //Why not use this.isTreeArch ??
        if (next || !isTree)
            this.select(next ? next : this.getTraverseParent(xmlNode));
        else
            this.clearSelection(null, true);
    }

    /**
     * Selects the next {@info TraverseNodes "Traverse Node"} when available.
     *
     * @param  {XMLNode}  xmlNode  required  The 'context' Traverse Node.
     */	
    this.selectNext = function(){
        var xmlNode = this.getNextTraverse();
        if (xmlNode)
            this.select(xmlNode);
    }
    
    /**
     * Selects the previous {@info TraverseNodes "Traverse Node"} when available.
     *
     * @param  {XMLNode}  xmlNode  required  The 'context' Traverse Node.
     * @see  SmartBinding
     */	
    this.selectPrevious = function(){
        var xmlNode = this.getNextTraverse(null, -1);
        if (xmlNode)
            this.select(xmlNode);	
    }
    
    /**
     * @private
     */
    this.getDefaultNext = function(xmlNode, isTree){
        var next = this.getNextTraverseSelected(xmlNode);
        //if(!next && xmlNode == this.XMLRoot) return;

        return (next && next != xmlNode)
            ? next
            : (isTree ? this.getTraverseParent(xmlNode) : false);
    }
    
    /**
     * Gets the number of currently selected nodes.
     *
     * @return  {Integer}  the number of currently selected nodes.
     */
    this.getSelectCount = function(){
        return valueList.length;
    }
    
    /**
     * Determines wether a node is selected.
     *
     * @param  {XMLNode}  xmlNode  required  The XMLNode to be checked.
     * @return  {Boolean}  true   the node is selected.
     *                   false  otherwise
     */
    this.isSelected = function(xmlNode){
        if (!xmlNode) return false;
        
        for (var i = 0; i < valueList.length; i++) {
            if (valueList[i] == xmlNode)
                return true;
        }
        
        return false;
    }
    
    /* ********************************************************************
                                        PRIVATE METHODS
    *********************************************************************/
    
    /**
     * @attribute  {Boolean}  multiselect  true   default  The uses may select multiple nodes. Default is false for j:Dropdown.
     *                                      false  The user cannot select multiple nodes.
     * @attribute  {Boolean}  autoselect  true   default  After data is loaded in this component a selection is immediately made. Default is false for j:Dropdown.
     *                                      false  No selection is made automatically
     *                             string   all    After data is loaded in this component all {@info TraverseNodes "Traverse Nodes"} are selected.
     * @attribute  {Boolean}  selectable  true   When set to true this component can receive a selection.
     * @attribute  {Boolean}  ctrl-select  false  When set to true the user makes a selection as if it was holding the Ctrl key.
     * @attribute  {Boolean}  allow-deselect  true   When set to true the user can remove the selection of a component.
     * @attribute  {Boolean}  reselectable  false  When set to true selected nodes can be selected again such that the select events are called.
     * @attribute  {String}  selected   String specifying the value of the {@info TraverseNodes "Traverse Node"} which should be selected after loading data in this component.
     */
    this.__addJmlLoader(function(x){
        if (x.getAttribute("multiselect"))
            this.multiselect = x.getAttribute("multiselect") != "false";
        if (x.getAttribute("autoselect"))
            this.autoselect = x.getAttribute("autoselect") != "false";
        if (x.getAttribute("selectable"))
            this.selectable = x.getAttribute("selectable") != "false";
        if (x.getAttribute("ctrlselect"))
            this.ctrlSelect = x.getAttribute("ctrlselect") == "true";
        if (x.getAttribute("allowdeselect") || this.allowDeselect === undefined) 
            this.allowDeselect = x.getAttribute("allowdeselect") != "false";
        if (x.getAttribute("delayedselect") || this.delayedSelect === undefined) 
            this.delayedSelect = x.getAttribute("delayedselect") != "false";
            
        this.allowDeselect = x.getAttribute("allow-deselect") != "false";
        this.reselectable  = x.getAttribute("reselectable") != "true";
        
        if (x.getAttribute("autoselect") == "all" && this.multiselect) {
            this.addEventListener("onafterload", function(){
                this.selectAll();
            });
        }
        
        if (x.getAttributeNode("selected")) {
            this.autoselect = true;
            this.selectXpath(x.getAttribute("selected"));
        }
    });
    
    // Select Bind class
    // #ifdef __WITH_DATABINDING
    this.addEventListener("onbeforeselect", function(e){
        if (this.applyRuleSetOnNode("select", e.xmlNode, ".") === false)
            return false;
    });
    // #endif
    
    // #ifdef __WITH_PROPERTY_BINDING
    this.addEventListener("onafterselect", function (e){
        if (this.bindingRules.value) {
            this.value = this.applyRuleSetOnNode("value", e.xmlNode);
            this.setProperty("value", this.value);
        }
    });
    // #endif
}

/**
 * @private
 */
jpf.MultiSelectServer = {
    /**
     * @private
     */
    objects : {},
    
    /**
     * @private
     */
    register : function(xmlId, xmlNode, selList, jNode){
        if (!this.uniqueId)
            this.uniqueId = jpf.all.push(this) - 1;
        
        this.objects[xmlId] = {
            xml   : xmlNode,
            list  : selList,
            jNode : jNode
        };
    },
    
    __xmlUpdate : function(action, xmlNode, listenNode, UndoObj){
        if (action != "attribute") return;

        var data = this.objects[xmlNode.getAttribute(jpf.XMLDatabase.xmlIdTag)];
        if (!data) return;

        var nodes = xmlNode.attributes;

        for (var j = 0; j < data.list.length; j++) {
            //data[j].setAttribute(UndoObj.name, xmlNode.getAttribute(UndoObj.name));
            jpf.XMLDatabase.setAttribute(data.list[j], UndoObj.name,
                xmlNode.getAttribute(UndoObj.name));
        }
        
        //jpf.XMLDatabase.synchronize();
    }
};

// #endif
