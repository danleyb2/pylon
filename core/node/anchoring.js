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

__ANCHORING__ = 1 << 13;

// #ifdef __WITH_ANCHORING

/**
 * Baseclass adding Anchoring features to this Component.
 *
 * @constructor
 * @baseclass
 * @author      Ruben Daniels
 * @version     %I%, %G%
 * @since       0.3
 */
jpf.Anchoring = function(){
    this.__regbase = this.__regbase | __ANCHORING__;
    
    var VERTICAL   = 1;
    var HORIZONTAL = 2;

    var l = jpf.layoutServer, inited = false, updateQueue = 0,
        hordiff, verdiff, rule_v = "", rule_h = "", rule_header,
        id, inited, parsed, disabled, _self = this;;
    
    /**
     * Turns anchoring off.
     *
     */
    this.disableAnchoring = function(activate){
        if (!parsed || !inited || disabled) 
            return;
        
        l.removeRule(this.pHtmlNode, this.uniqueId + "_anchors");
        l.queue(this.pHtmlNode);
        
        this.__propHandlers["left"]   = 
        this.__propHandlers["width"]  = 
        this.__propHandlers["right"]  = 
        this.__propHandlers["top"]    = 
        this.__propHandlers["height"] = 
        this.__propHandlers["bottom"] = null;
        
        this.__domHandlers["remove"].remove(remove);
        this.__domHandlers["reparent"].remove(reparent);
        
        if (this.right)
            this.oExt.style.left = this.oExt.offsetLeft;
        
        if (this.bottom)
            this.oExt.style.top = this.oExt.offsetTop;
        
        disabled = true;
    }
    
    /**
     * Enables anchoring based on attributes set in the JML of this component
     *
     * @param  {Boolean}  activate  optional  true  the anchoring rules are activated.
     *                                      false  default  the anchoring rules remain unactivated.
     *
     * @attribute  {Integer}  left   optional  Integer specifying the amount of pixels from the left border of this component to the left edge of it's parent's border.
     * @attribute  {Integer}  right  optional  Integer specifying the amount of pixels from the right border of this component to the right edge of it's parent's border.
     * @attribute  {Integer}  width  optional  Integer specifying the amount of pixels from the left border to the right border of this component.
     * @attribute  {Integer}  top    optional  Integer specifying the amount of pixels from the top border of this component to the top edge of it's parent's border.
     * @attribute  {Integer}  bottom optional  Integer specifying the amount of pixels from the bottom border of this component to the bottom edge of it's parent's border.
     * @attribute  {Integer}  height optional  Integer specifying the amount of pixels from the top border to the bottom border of this component.
     */
    this.enableAnchoring = function(){
        if (inited) //@todo add code to reenable anchoring rules (when showing)
            return;
        
        /**** Properties and Attributes ****/
        
        this.__supportedProperties.push("right", "bottom", "width", 
            "left", "top", "height");
        
        this.__propHandlers["left"]  = 
        this.__propHandlers["width"] = 
        this.__propHandlers["right"] = function(value){
            if (!updateQueue && jpf.loaded)
                l.queue(this.pHtmlNode, this);
            updateQueue = updateQueue | HORIZONTAL;
        };
        
        this.__propHandlers["top"]    = 
        this.__propHandlers["height"] = 
        this.__propHandlers["bottom"] = function(value){
            if (!updateQueue && jpf.loaded)
                l.queue(this.pHtmlNode, this);
            updateQueue = updateQueue | VERTICAL;
        };
        
        /**** DOM Hooks ****/
    
        this.__domHandlers["remove"].push(remove);
        this.__domHandlers["reparent"].push(reparent);
        
        inited   = true;
    }
    
    function remove(doOnlyAdmin){
        if (doOnlyAdmin)
            return;

        l.removeRule(this.pHtmlNode, this.uniqueId + "_anchors");
        l.queue(this.pHtmlNode)
    }
    
    function reparent(beforeNode, pNode, withinParent, oldParent){
        if (!this.__jmlLoaded)
            return;
        
        if (!withinParent && !disabled && parsed) //@todo hmm weird state check
            this.__moveAnchoringRules(oldParent);
    }
    
    /**
     * @private
     */
    this.__moveAnchoringRules = function(oldParent, updateNow){
        var rules = l.removeRule(oldParent, this.uniqueId + "_anchors");
        if (rules)
            l.queue(oldParent);
        
        if (!rule_v && !rule_h)
            return;
        
        rule_header = getRuleHeader.call(this);
        rules = rule_header + "\n" + rule_v + "\n" + rule_h;
        
        this.oExt.style.display = "none";
        
        l.setRules(this.pHtmlNode, this.uniqueId + "_anchors", rules);
        l.queue(this.pHtmlNode, this);
    }
    
    function getRuleHeader(){
        return "\
            var oHtml = " + (jpf.hasHtmlIdsInJs 
                ? this.oExt.getAttribute("id")
                : "document.getElementById('" 
                    + this.oExt.getAttribute("id") + "')") + ";\
            \
            var pWidth = " + (this.pHtmlNode == this.pHtmlDoc.body
                ? (jpf.isIE 
                    ? "document.documentElement.offsetWidth" 
                    : "window.innerWidth")
                : "oHtml.parentNode.offsetWidth") + ";\
            \
            var pHeight = " + (this.pHtmlNode == this.pHtmlDoc.body
                ? (jpf.isIE 
                    ? "document.documentElement.offsetHeight" 
                    : "window.innerHeight")
                : "oHtml.parentNode.offsetHeight") + ";";
    }
    
    /**
     * @macro
     */
    function setPercentage(expr, value){
        return expr.replace(jpf.percentageMatch, "((" + value + " * $1)/100)");
    }
    
    this.__updateLayout = function(){
        if (!parsed) {
            if (!this.oExt.getAttribute("id")) 
                jpf.setUniqueHtmlId(this.oExt);
            
            var diff    = jpf.getDiff(this.oExt);
            hordiff     = diff[0];
            verdiff     = diff[1];
            rule_header = getRuleHeader.call(this);
            parsed      = true;
        }
        
        if (!updateQueue) {
            this.oExt.style.display = "block";
            return;
        }

        if (this.left || this.top || this.right || this.bottom)
            this.oExt.style.position = "absolute";
        
        var rules;

        if (updateQueue & HORIZONTAL) {
            rules = [];

            var left  = this.left;
            var right = this.right;
            var width = this.width;
            
            if (right && typeof right == "string")
                right = setPercentage(right, "pWidth");
            
            if (left) {
                if (parseInt(left) != left) {
                    left = setPercentage(left,  "pWidth");
                    rules.push("oHtml.style.left = (" + left + ") + 'px'");
                }
                else 
                    this.oExt.style.left = left + "px";
            }
            if (!left && right) {
                if (parseInt(right) != right) {
                    right = setPercentage(right, "pWidth");
                    rules.push("oHtml.style.right = (" + right + ") + 'px'");
                }
                else 
                    this.oExt.style.right = right + "px";
            }
            if (width) {
                if (parseInt(width) != width) {
                    width = setPercentage(width, "pWidth");
                    rules.push("oHtml.style.width = (" 
                        + width + " - " + hordiff + ") + 'px'");
                }
                else 
                    this.oExt.style.width = (width - hordiff) + "px";
            }
            
            if (right != null && left != null) {
                rules.push("oHtml.style.width = (pWidth - (" + right 
                    + ") - (" + left + ") - " + hordiff + ") + 'px'");
            }
            
            rule_h = (rules.length 
                ? "try{" + rules.join(";}catch(e){};try{") + ";}catch(e){};" 
                : "");
        }
        
        if (updateQueue & VERTICAL) {
            rules = [];
            
            var top    = this.top;
            var bottom = this.bottom;
            var height = this.height;
            
            if (bottom && typeof bottom == "string")
                bottom = setPercentage(bottom, "pHeight");
            
            if (top) {
                if (parseInt(top) != top) {
                    top = setPercentage(top, "pHeight");
                    rules.push("oHtml.style.top = (" + top + ") + 'px'");
                }
                else 
                    this.oExt.style.top = top + "px";
            }
            if (!top && bottom) {
                if (parseInt(bottom) != bottom) {
                    rules.push("oHtml.style.bottom = (" + bottom + ") + 'px'");
                }
                else 
                    this.oExt.style.bottom = bottom + "px";
            }
            if (height) {
                if (parseInt(height) != height) {
                    height = setPercentage(height, "pHeight");
                    rules.push("oHtml.style.height = (" + height + " - " + verdiff + ") + 'px'");
                }
                else 
                    this.oExt.style.height = (height - verdiff) + "px";
            }
            
            if (bottom != null && top != null) {
                rules.push("oHtml.style.height = (pHeight - (" + bottom +
                    ") - (" + top + ") - " + verdiff + ") + 'px'");
            }

            rule_v = (rules.length 
                ? "try{" + rules.join(";}catch(e){};try{") + ";}catch(e){};" 
                : "");
        }
        
        if (rule_v || rule_h) {
            l.setRules(this.pHtmlNode, this.uniqueId + "_anchors", 
                rule_header + "\n" + rule_v + "\n" + rule_h, true);
        }
        
        updateQueue = 0;
        disabled = false;
    }
    
    this.__addJmlLoader(function(){
        if (updateQueue)
            this.__updateLayout();
    });
}

// #endif
