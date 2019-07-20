
/**
 * Ghison-State 
 * 
 * Design and Develop by: Beman Ghison (Behnam Ghiaseddin)
 * email: beman.ghison@gmail.com
 * 
 * Project: https://github.com/ghison/state
 * First Release Date: 2019-05-09
 * Last Update: 2019-07-19
 * Version: 0.3.4 , Not an stable version and under change
 * 
 * Description:
 *    State machine manager to use in application such as 
 *      repeatitive non-sequential tasks,
 *      communication, 
 *      IoT, 
 *      controlling, 
 *      protocol handling, 
 *      robotices,
 * 
 *    this library try to be simple and efficient.
 * 
 *    This software is free to use for any non-commercial application.
 *    For commercial application there is a little fee. you can contact me about it.
 */


class GhisonState {
    /**
     * 
     * @param {*} states 
     */
    constructor(states) {
        this.states = states;

        if (states.global) {
            this.global = states.global;
        }
        else {
            this.global = {};
        }
        /* WORKHERE: BGH @2019-07-18 - remove global from states (just for safety) */

        if (this.global.idleState) {
            this.current = this.global.idleState;
        }
        else if (states.idle) {
            this.global.idleState = 'idle';
            this.current = 'idle';
        }
        else {
            this.current = null;
        }

        if (this.global.startState) {
            this.start = this.global.startState;
        }
        else if (states.start) {
            this.global.startState = 'start';
            this.start = 'start';
        }
        else {
            this.start = null;
        }

        this.prevState = undefined; 
        this.firstTime = true;        

        if (this.current) {
            this.change(this.current);
        }
    }

    destruct() {
        clearTimeout(this.stateTimeout);
        clearTimeout(this.repeatEnterTimeout);
        clearTimeout(this.repeatTimeout);
        clearTimeout(this.global.busyTimer);
    }

    /**
     * 
     * @param {*} newState 
     * @param  {...any} args 
     */
    change(newState, ...args) {
        if (this.states[newState]) {
            /* automatic finish extra of new state, like timeout - BGH @2019-05-09 */  
            clearTimeout(this.stateTimeout);
            clearTimeout(this.repeatEnterTimeout);
            clearTimeout(this.repeatTimeout);

            /* exit of old state - BGH @2019-05-09 */
            if (!this.firstTime) { /* exit scenario should not get run on first time - BGH @2019-07-17 */               
                let exitAction = this.prop('exit');
                if (exitAction) {
                    exitAction();
                }       
            }
            else {
                this.firstTime = false;
            }

            let becomeBusy = false;
            if ((this.current === this.states.startState) && 
                (newState !== this.states.startState) 
            ) {
                becomeBusy = true;
            }

            this.current = newState;

            // /* automatic extra of new state, like timeout - BGH @2019-05-09 */
            // let timeout = this.prop('timeout');
            // let timeoutAct = this.prop('timeoutAct');

            // if (timeout && timeoutAct) {
            //     if (typeof timeoutAct === 'function') {
            //         this.stateTimeout = setTimeout(timeoutAct, timeout);
            //     }
            //     else if (typeof timeoutAct === 'string') {
            //         this.stateTimeout = setTimeout(() => {
            //             this.change(timeoutAct);
            //         }, timeout);
            //     }
            // }

            this._setTimer();

            let repeatEnter = this.prop('repeatEnter');
            let enterAction = this.prop('enter');

            /* repeat current state enter function after time - BGH @2019-07-13 */
            if (repeatEnter && enterAction) {
                this.repeatEnterTimeout = setInterval(() => {
                    enterAction();
                }, repeatEnter);
                
            }

            /* enter of new state - BGH @2019-05-09 */
            if (enterAction) {
                enterAction();
            }

            this.manager(...args); /* main action of current state - BGH @2019-05-09 */   
            
            /* repeat current state enter function after time - BGH @2019-07-13 */
            let repeatTime = this.prop('repeat');

            if (repeatTime) {
                this.repeatTimeout = setInterval(() => {
                    this.manager(...args);
                }, repeatTime);
                
            }

            /* state independent actions - BGH @2019-07-16 */
            if (this.global) {
                /* busy timeout  - BGH @2019-07-16 */
                if (!this.busy) {      
                            
                    clearTimeout(this.global.busyTimer);
                }
                else if (becomeBusy) {
                    if (this.global.busyTimeout) {
                        this.global.busyTimer = setTimeout(() => {
                            this.change(this.states.startState);
                        }, this.global.busyTimeout);
                    }
                }
            }

            return true;
        }
        return false; /* error equivalent - BGH @2019-05-09 */
    }

    /**
     * 
     * @param  {...any} args 
     */
    manager(...args) {
        let beforeAction = this.global.beforeAction;
        let action = this.prop('action');
        let afterAction = this.global.afterAction;
        process.nextTick(() => {
            if (beforeAction) {
                if (beforeAction()) {
                    return;
                }
            }    
            if (action) {
                action(...args); /* run current state. - BGH @2019-05-09 */                
            }
            if (afterAction) {
                afterAction();
            }    
        });

        // let thisState = this.states[this.current];
        // if (typeof thisState === 'function') {                    
        //     process.nextTick(() => {
        //         thisState(...args); /* run current state. - BGH @2019-05-09 */                
        //     });
        // }
        // else {
        //     if (thisState.action) {
        //         process.nextTick(() => {
        //             thisState.action(...args); //this.prevState !== this.current, <<<used as first parameter detect repeating.
        //         });
        //     }
        // }
        this.prevState = this.current;
    }
    
    /**
     * 
     * @param {String} state 
     */
    start(state) {
        if (!this.busy) {
            if (state) {
                this.change(state);
            }
            else if (this.start) {
                this.change(this.start);
            }
        }
    }
    /**
     * 
     * @param {String} state 
     */
    is(state) {        
        return (state.toUpperCase() === this.current.toUpperCase()); 
    }
    
    /**
     * make sure the state machine is on initial state (interpret as idle) or other state (busy)
     */
    get busy() {
        return (this.current !== this.states.startState);
    }

    /**
     * 
     */
    retime() {
        clearTimeout(this.stateTimeout);
        this._setTimer();
    }

    /**
     * 
     * @param {*} event 
     * @param {*} callback 
     */
    on(event, callback) {
        this.callbacks[event] = callback;
    }


    /**
     * 
     * @param {*} event 
     * @param  {...any} args 
     */
    callEvent(event, ...args) {
        if (this.callbacks[event]) {
            return this.callbacks[event](...args);
        }   
        return false;
    }  
    
    /**
     * 
     * @param {*} key 
     */
    prop(key) {
        let thisState = this.states[this.current];
        if (typeof thisState === 'object') {
            if (thisState[key]) {
                return thisState[key];
            }
            return null;
        }
        else if (typeof thisState === 'function') {
            if (key === 'action') {
                return thisState;
            }
            return null;
        }
        return null;
    }

    /**
     * 
     */
    _setTimer() {
        /* automatic extra of new state, like timeout - BGH @2019-05-09 */
        let timeout = this.prop('timeout');
        let timeoutAct = this.prop('timeoutAct');
                
        if (timeout && timeoutAct) {
            if (typeof timeoutAct === 'function') {
                this.stateTimeout = setTimeout(timeoutAct, timeout);
            }
            else if (typeof timeoutAct === 'string') {
                this.stateTimeout = setTimeout(() => {
                    this.change(timeoutAct);
                }, timeout);
            }
        }        
    }
    

}

module.exports = GhisonState;