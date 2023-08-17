const api = new ripple.RippleAPI({
    server: "wss://s.altnet.rippletest.net:51233/"
});

api.on("error", (errorCode, errorMessage) => {
    console.log(errorCode + ": " + errorMessage);
});

api.on("connected", () => {
    console.log("connected");
    setConnection(true);
});

api.on("disconnected", code => {
    console.log("disconnected, code:", code);
    setConnection(false);
});

var account = null;

setAccount();

function setAccount() {
    $.ajax({
        type: "POST",
        url: "https://faucet.altnet.rippletest.net/accounts",
        success: res => {
            console.log(res);

            if (res.account) {
                checkAccount(res.account);
            }
        }
    });
}

function setBalance() {
    api.getAccountInfo(account.xAddress).then(response => {
        console.log(response);
        $("#balance").text(response.xrpBalance);

        if (response.xrpBalance <= 25) {
            setAccount();
        }
    });
}

function checkAccount(resAccount) {
    setInputs(false);

    setTimeout(() => {
        api.getAccountInfo(resAccount.xAddress).then(response => {
            console.log(response);
            account = resAccount;
            $("#testnet_address").text(resAccount.address);
            $("#testnet_secret").text(resAccount.secret);
            setInputs(true);
            setBalance();
        }).catch(() => {
            checkAccount(resAccount);
        });
    }, 2 * 1000);
}

api.connect().then(() => {
    $("#send").click(() => {
        if (account === null) {
            M.toast({html: "Something went wrong!"});
            return;
        }

        if ($("#address").val() === "") {
            M.toast({html: "Enter an address."});
            return;
        }

        if (!api.isValidAddress($("#address").val())) {
            M.toast({html: "Address is not valid!"});
            return;
        }

        if ($("#address").val().trim() === account.address.trim()) {
            M.toast({html: "You can't send XRP to faucet address!"});
            return;
        }

        if ($("#destination-tag").val() !== "" && (!$.isNumeric($("#destination-tag").val()) || parseInt($("#destination-tag").val()) > 4294967295)) {
            M.toast({html: "Destination Tag is not valid!"});
            return;
        }

        if ($("#amount").val() === "") {
            M.toast({html: "Enter amount."});
            return;
        }

        if (!$.isNumeric($("#amount").val())) {
            M.toast({html: "Amount is not valid!"});
            return;
        }

        api.getServerInfo().then(serverInfo => {
            var tx_json = {
                Account: account.address,
                TransactionType: "Payment",
                LastLedgerSequence: serverInfo.validatedLedger.ledgerVersion + 4,
                Destination: $("#address").val(),
                Amount: api.xrpToDrops($("#amount").val())
            };

            if ($("#destination-tag").val() !== "") {
                tx_json.DestinationTag = parseInt($("#destination-tag").val());
            }

            api.prepareTransaction(tx_json).then(prepared => {
                console.log(prepared);

                var sign = api.sign(prepared.txJSON, account.secret);
                console.log(sign);

                api.submit(sign.signedTransaction).then(submit => {
                    console.log(submit);

                    if (submit.engine_result === "tesSUCCESS") {
                        var tr = $('#transactions tbody tr:first').clone().removeAttr('style');
                        tr.attr('id', submit.tx_json.hash);

                        $(tr).children('td').eq(0).html("<a href='https://test.bithomp.com/explorer/"+ submit.tx_json.hash +"' target='_blank'>"+ submit.tx_json.hash +"</a>");
                        $(tr).children('td').eq(1).text("false");
                        $(tr).children('td').eq(2).text(submit.resultCode);

                        $('#transactions tbody').prepend(tr);

                        trackTransaction(submit.tx_json.hash);
                    }

                    M.toast({html: submit.resultMessage});
                }).catch(error => {
                    console.log(error);
                });

            }).catch(error => {
                console.log(error);
            });
        }).catch(error => {
            console.log(error);
        });
    });
}).catch(e => {
    setConnection(false);
    console.error(e);
});

function trackTransaction(hash) {
    setTimeout(async () => {
        api.request("tx", {
            transaction: hash
        }).then(response => {
            console.log(response.validated);

            if (response.validated) {
                $("#"+ hash +"").children('td').eq(1).text("true");
                console.log("ok");
                setBalance();
            } else {
                return trackTransaction(hash);
            }
        });
    }, 3 * 1000);
}

function setInputs(success) {
    if (success) {
        $("button").removeClass("disabled");
    } else {
        $("button").addClass("disabled");
    }
}

function setConnection(success) {
    if (!success) {
        M.toast({html: "Connection failed, refreshing page might be helpful."});
    }

    $("#connection").removeClass("success fail").addClass(success ? "success" : "fail");
    $("#connection span").text(success ? "Connected" : "Connection failed");
}