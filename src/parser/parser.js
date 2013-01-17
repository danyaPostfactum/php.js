/*
 * @author Niklas von Hertzen <niklas at hertzen.com>
 * @created 15.6.2012
 * @website http://hertzen.com
 */

/*
 * The skeleton for this parser was written by Moriyoshi Koizumi and is based on
 * the work by Masato Bito and is in the PUBLIC DOMAIN.
 * Ported to JavaScript by Niklas von Hertzen
 */


PHP.Parser = function ( preprocessedTokens, eval ) {

    var yybase = this.yybase,
    yydefault = this.yydefault,
    yycheck = this.yycheck,
    yyaction = this.yyaction,
    yylen = this.yylen,
    yygbase = this.yygbase,
    yygcheck = this.yygcheck,
    yyp = this.yyp,
    yygoto = this.yygoto,
    yylhs = this.yylhs,
    terminals = this.terminals,
    translate = this.translate,
    yygdefault = this.yygdefault;


    this.pos = -1;
    this.line = 1;

    this.tokenMap = this.createTokenMap( );

    this.dropTokens = {};
    this.dropTokens[ PHP.Constants.T_WHITESPACE ] = 1;
    this.dropTokens[ PHP.Constants.T_OPEN_TAG ] = 1;
    var tokens = [];

    // pre-process
    preprocessedTokens.forEach( function( token, index ) {
        if ( typeof token === "object" && token[ 0 ] === PHP.Constants.T_OPEN_TAG_WITH_ECHO) {
            tokens.push([
                PHP.Constants.T_OPEN_TAG,
                token[ 1 ],
                token[ 2 ]
                ]);
            tokens.push([
                PHP.Constants.T_ECHO,
                token[ 1 ],
                token[ 2 ]
                ]);
        } else {
            tokens.push( token );
        }
    });
    this.tokens = tokens;

    // We start off with no lookahead-token
    var tokenId = this.TOKEN_NONE;

    // The attributes for a node are taken from the first and last token of the node.
    // From the first token only the startAttributes are taken and from the last only
    // the endAttributes. Both are merged using the array union operator (+).
    this.startAttributes = {
        'startLine': 1
    };

    this.endAttributes = {};

    // In order to figure out the attributes for the starting token, we have to keep
    // them in a stack
    var attributeStack = [ this.startAttributes ];

    // Start off in the initial state and keep a stack of previous states
    var state = 0;
    var stateStack = [ state ];

    // AST stack
    this.yyastk = [];

    // Current position in the stack(s)
    this.stackPos  = 0;

    var yyn;

    var origTokenId;


    for (;;) {

        if ( yybase[ state ] === 0 ) {
            yyn = yydefault[ state ];
        } else {
            if (tokenId === this.TOKEN_NONE ) {
                // fetch the next token id from the lexer and fetch additional info by-ref
                origTokenId = this.getNextToken( );

                // map the lexer token id to the internally used token id's
                tokenId = (origTokenId >= 0 && origTokenId < this.TOKEN_MAP_SIZE) ? translate[ origTokenId ] : this.TOKEN_INVALID;

                attributeStack[ this.stackPos ] = this.startAttributes;
            }

            if (((yyn = yybase[ state ] + tokenId) >= 0
                && yyn < this.YYLAST && yycheck[ yyn ] === tokenId
                || (state < this.YY2TBLSTATE
                    && (yyn = yybase[state + this.YYNLSTATES] + tokenId) >= 0
                    && yyn < this.YYLAST
                    && yycheck[ yyn ] === tokenId))
            && (yyn = yyaction[ yyn ]) !== this.YYDEFAULT ) {
                /*
                 * >= YYNLSTATE: shift and reduce
                 * > 0: shift
                 * = 0: accept
                 * < 0: reduce
                 * = -YYUNEXPECTED: error
                 */
                if (yyn > 0) {
                    /* shift */
                    ++this.stackPos;

                    stateStack[ this.stackPos ] = state = yyn;
                    this.yyastk[ this.stackPos ] = this.tokenValue;
                    attributeStack[ this.stackPos ] = this.startAttributes;
                    tokenId = this.TOKEN_NONE;

                    if (yyn < this.YYNLSTATES)
                        continue;

                    /* $yyn >= YYNLSTATES means shift-and-reduce */
                    yyn -= this.YYNLSTATES;
                } else {
                    yyn = -yyn;
                }
            } else {
                yyn = yydefault[ state ];
            }
        }

        for (;;) {
            /* reduce/error */

            if ( yyn === 0 ) {
                /* accept */
                return this.yyval;
            } else if (yyn !== this.YYUNEXPECTED ) {
                /* reduce */
                for (var attr in this.endAttributes) {
                    attributeStack[ this.stackPos - yylen[ yyn ] ][ attr ] = this.endAttributes[ attr ];
                }
                try {
                    this['yyn' + yyn](attributeStack[ this.stackPos - yylen[ yyn ] ]);
                } catch (e) {
                    /*
                        if (-1 === $e->getRawLine()) {
                            $e->setRawLine($startAttributes['startLine']);
                        }
                     */
                    throw e;
                }

                /* Goto - shift nonterminal */
                this.stackPos -= yylen[ yyn ];
                yyn = yylhs[ yyn ];
                if ((yyp = yygbase[ yyn ] + stateStack[ this.stackPos ]) >= 0
                    && yyp < this.YYGLAST
                    && yygcheck[ yyp ] === yyn) {
                    state = yygoto[ yyp ];
                } else {
                    state = yygdefault[ yyn ];
                }

                ++this.stackPos;

                stateStack[ this.stackPos ] = state;
                this.yyastk[ this.stackPos ] = this.yyval;
                attributeStack[ this.stackPos ] = this.startAttributes;
            } else {
                /* error */
                if (eval !== true) {

                    var expected = [];

                    for (var i = 0; i < this.TOKEN_MAP_SIZE; ++i) {
                        if ((yyn = yybase[ state ] + i) >= 0 && yyn < this.YYLAST && yycheck[ yyn ] == i
                         || state < this.YY2TBLSTATE
                            && (yyn = yybase[ state + this.YYNLSTATES] + i)
                            && yyn < this.YYLAST && yycheck[ yyn ] == i
                        ) {
                            if (yyaction[ yyn ] != this.YYUNEXPECTED) {
                                if (expected.length == 4) {
                                    /* Too many expected tokens */
                                    expected = [];
                                    break;
                                }

                                expected.push( this.terminals[ i ] );
                            }
                        }
                    }

                    var expectedString = '';
                    if (expected.length) {
                        expectedString = ', expecting ' + expected.join(' or ');
                    }
                    throw new PHP.ParseError('syntax error, unexpected ' + terminals[ tokenId ] + expectedString, this.startAttributes['startLine']);
                } else {
                    return this.startAttributes['startLine'];
                }

            }

            if (state < this.YYNLSTATES)
                break;
            /* >= YYNLSTATES means shift-and-reduce */
            yyn = state - this.YYNLSTATES;
        }
    }
};

PHP.ParseError = function( msg, line ) {
    this.message = msg;
    this.line = line;
};

PHP.Parser.prototype.MODIFIER_PUBLIC    =  1;
PHP.Parser.prototype.MODIFIER_PROTECTED =  2;
PHP.Parser.prototype.MODIFIER_PRIVATE   =  4;
PHP.Parser.prototype.MODIFIER_STATIC    =  8;
PHP.Parser.prototype.MODIFIER_ABSTRACT  = 16;
PHP.Parser.prototype.MODIFIER_FINAL     = 32;

PHP.Parser.prototype.getNextToken = function( ) {

    this.startAttributes = {};
    this.endAttributes = {};

    var token,
    tmp;

    while (this.tokens[++this.pos] !== undefined) {
        token = this.tokens[this.pos];

        if (typeof token === "string") {
            this.startAttributes['startLine'] = this.line;
            this.endAttributes['endLine'] = this.line;

            this.tokenValue = token;
            return token.charCodeAt(0);
        } else {



            this.line += ((tmp = token[ 1 ].match(/\n/g)) === null) ? 0 : tmp.length;

            if (PHP.Constants.T_COMMENT === token[0]) {

                if (!Array.isArray(this.startAttributes['comments'])) {
                    this.startAttributes['comments'] = [];
                }

                this.startAttributes['comments'].push( {
                    type: "comment",
                    comment: token[1],
                    line: token[2]
                });

            } else if (PHP.Constants.T_DOC_COMMENT === token[0]) {
                this.startAttributes['comments'].push( new PHPParser_Comment_Doc(token[1], token[2]) );
            } else if (this.dropTokens[token[0]] === undefined) {
                this.tokenValue = token[1];
                this.startAttributes['startLine'] = token[2];
                this.endAttributes['endLine'] = this.line;

                return this.tokenMap[token[0]];
            }
        }
    }

    this.startAttributes['startLine'] = this.line;

    // 0 is the EOF token
    return 0;
};

PHP.Parser.prototype.tokenName = function( token ) {
    var constants = ["T_INCLUDE","T_INCLUDE_ONCE","T_EVAL","T_REQUIRE","T_REQUIRE_ONCE","T_LOGICAL_OR","T_LOGICAL_XOR","T_LOGICAL_AND","T_PRINT","T_PLUS_EQUAL","T_MINUS_EQUAL","T_MUL_EQUAL","T_DIV_EQUAL","T_CONCAT_EQUAL","T_MOD_EQUAL","T_AND_EQUAL","T_OR_EQUAL","T_XOR_EQUAL","T_SL_EQUAL","T_SR_EQUAL","T_BOOLEAN_OR","T_BOOLEAN_AND","T_IS_EQUAL","T_IS_NOT_EQUAL","T_IS_IDENTICAL","T_IS_NOT_IDENTICAL","T_IS_SMALLER_OR_EQUAL","T_IS_GREATER_OR_EQUAL","T_SL","T_SR","T_INSTANCEOF","T_INC","T_DEC","T_INT_CAST","T_DOUBLE_CAST","T_STRING_CAST","T_ARRAY_CAST","T_OBJECT_CAST","T_BOOL_CAST","T_UNSET_CAST","T_NEW","T_CLONE","T_EXIT","T_IF","T_ELSEIF","T_ELSE","T_ENDIF","T_LNUMBER","T_DNUMBER","T_STRING","T_STRING_VARNAME","T_VARIABLE","T_NUM_STRING","T_INLINE_HTML","T_CHARACTER","T_BAD_CHARACTER","T_ENCAPSED_AND_WHITESPACE","T_CONSTANT_ENCAPSED_STRING","T_ECHO","T_DO","T_WHILE","T_ENDWHILE","T_FOR","T_ENDFOR","T_FOREACH","T_ENDFOREACH","T_DECLARE","T_ENDDECLARE","T_AS","T_SWITCH","T_ENDSWITCH","T_CASE","T_DEFAULT","T_BREAK","T_CONTINUE","T_GOTO","T_FUNCTION","T_CONST","T_RETURN","T_TRY","T_CATCH","T_THROW","T_USE","T_INSTEADOF","T_GLOBAL","T_STATIC","T_ABSTRACT","T_FINAL","T_PRIVATE","T_PROTECTED","T_PUBLIC","T_VAR","T_UNSET","T_ISSET","T_EMPTY","T_HALT_COMPILER","T_CLASS","T_TRAIT","T_INTERFACE","T_EXTENDS","T_IMPLEMENTS","T_OBJECT_OPERATOR","T_DOUBLE_ARROW","T_LIST","T_ARRAY","T_CALLABLE","T_CLASS_C","T_TRAIT_C","T_METHOD_C","T_FUNC_C","T_LINE","T_FILE","T_COMMENT","T_DOC_COMMENT","T_OPEN_TAG","T_OPEN_TAG_WITH_ECHO","T_CLOSE_TAG","T_WHITESPACE","T_START_HEREDOC","T_END_HEREDOC","T_DOLLAR_OPEN_CURLY_BRACES","T_CURLY_OPEN","T_PAAMAYIM_NEKUDOTAYIM","T_DOUBLE_COLON","T_NAMESPACE","T_NS_C","T_DIR","T_NS_SEPARATOR"];
    var current = "UNKNOWN";
    constants.some(function( constant ) {
        if (PHP.Constants[ constant ] === token) {
            current = constant;
            return true;
        } else {
            return false;
        }
    });

    return current;
};

/**
 * Creates the token map.
 *
 * The token map maps the PHP internal token identifiers
 * to the identifiers used by the PHP.Parser. Additionally it
 * maps T_OPEN_TAG_WITH_ECHO to T_ECHO and T_CLOSE_TAG to ';'.
 *
 * @return array The token map
 */

PHP.Parser.prototype.createTokenMap = function() {
    var tokenMap = {},
    name,
    i;
    var T_DOUBLE_COLON = PHP.Constants.T_PAAMAYIM_NEKUDOTAYIM;
    // 256 is the minimum possible token number, as everything below
    // it is an ASCII value
    for ( i = 256; i < 1000; ++i ) {
        // T_DOUBLE_COLON is equivalent to T_PAAMAYIM_NEKUDOTAYIM
        if ( T_DOUBLE_COLON === i ) {
            tokenMap[ i ] = this.T_PAAMAYIM_NEKUDOTAYIM;
        // T_OPEN_TAG_WITH_ECHO with dropped T_OPEN_TAG results in T_ECHO
        } else if( PHP.Constants.T_OPEN_TAG_WITH_ECHO === i ) {
            tokenMap[ i ] = PHP.Constants.T_ECHO;
        // T_CLOSE_TAG is equivalent to ';'
        } else if( PHP.Constants.T_CLOSE_TAG === i ) {
            tokenMap[ i ] = 59;
        // and the others can be mapped directly
        } else if ( 'UNKNOWN' !== (name = this.tokenName( i ) ) ) {

            tokenMap[ i ] =  this[name];
        }
    }
    return tokenMap;
};
