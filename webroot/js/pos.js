/* global $:false, Weed:false */
/* eslint browser:0, multivar:1, white:1, no-console: "off" */
/**
	Point-of-Sale JavaSCript
*/

var Weed = Weed || {};

Weed.POS = {

	init_done:false,
	init:function(m)
	{
		// Some times the browswer can fire load twice, so trap that
		if (Weed.POS.init_done) return(0);
		Weed.POS.init_done = true;

		switch (m) {
		case 'front':
			// Save O as terminal ID?
			Weed.POS.pull();
			setInterval(function() {
				Weed.POS.pull();
			}, 2345);
			break;
		}
	},
	ping_tick: null,
	ping: function() {
		$.get('/pos/ajax?a=ping');
		if (null === Weed.POS.ping_tick) {
			Weed.POS.ping_tick = setInterval(Weed.POS.ping, 60 * 1000);
			return;
		}
	},
	pull: function() {
		$.get('/pos/ajax?a=pull', function(res, ret, xhr) {
			switch (xhr.status) {
			case 200:
				$('#pos-front-view').html(res);
				break;
			case 304:
				// Ignore
				break;
			}
		});
	},
	push: function(fd)
	{
		$.post('/pos/ajax?a=push', fd);
	},
	sale: {
		due: 0,
		sum: 0,
		tax_i502: 0,
		tax_sale: 0,
		setVal: function(k, v) {
			var self = this; // The Sale. object
			self[k] = v;
			// Recalc All the Things?
		}
	}
};


Weed.POS.Ticket = {

	checkSaleLimits: function()
	{
		var cur_22 = 0; // Solid Infused
		var cur_23 = 0; // Liquid Infused
		var cur_24 = 0; // Extract to Inhale
		var cur_28 = 0; // Usable

		$('.psi-item-item').each(function(i, n) {

			var id = $(n).data('id');

			var q = $('#psi-item-' + id + '-size').val();
			if (isNaN(q)) {
				console.log('Weed.POS.Ticket.checkSaleLimits - Bad Quantity for Item: ' + id);
				return(0);
			}

			var w = $(n).data('weight');
			if (isNaN(w)) {
				console.log('Weed.POS.Ticket.checkSaleLimits - Bad Weight for Item: ' + id);
				return(0);
			}

			var k = $(n).data('kind');
			switch (k) {
			case 22:
				cur_22 += (w * q);
				break;
			case 23:
				cur_23 += (w * q);
				break;
			case 24:
				cur_24 += (w * q);
				break;
			case 28:
				cur_28 += (w * q);
				break;
			}

		});

		var pass = true;
		if (cur_22 > 453) {
			pass = false;
		}
		if (cur_23 > 2000) {
			pass = false;
		}
		if (cur_24 > 7) {
			pass = false;
		}
		if (cur_28 > 28) {
			pass = false;
		}

		if (!pass) {
			Weed.modal( $('#pos-modal-transaction-limit') );
			$('#pos-modal-transaction-limit').show();
		}

	}

};



function chkSaleCost()
{
	console.log('chkSaleCost()');

	Weed.POS.sale.sub = 0;

	$('.psi-item-item').each(function(x, n) {

		var i = $(n).data('id');
		var q = $('#psi-item-' + i + '-size').val();

		if (isNaN(q)) {
			console.log('chkSaleCost - Bad Q');
		}

		var r = $(n).data('price');
		if (isNaN(r)) {
			r = $('#inv-item-' + i).data('price');
			if (isNaN(r)) {
				console.log('chkSaleCost - Bad R');
			}
		}

		Weed.POS.sale.sub += (q * r);
	});

	if (isNaN(Weed.POS.sale.sub)) {
		Weed.POS.sale.sub = 0;
	}

	Weed.POS.sale.tax_i502 = 0; // Weed.POS.sale.sub * 0.25;
	Weed.POS.sale.tax_sale = (Weed.POS.sale.sub + Weed.POS.sale.tax_i502) * 0.095;
	Weed.POS.sale.due	  = Weed.POS.sale.sub + Weed.POS.sale.tax_i502 + Weed.POS.sale.tax_sale;

	// Canonical
	$('.pos-checkout-sub').html(parseFloat(Weed.POS.sale.sub, 10).toFixed(2));
	$('.pos-checkout-tax-i502').html(parseFloat(Weed.POS.sale.tax_i502, 10).toFixed(2));
	$('.pos-checkout-tax-sale').html(parseFloat(Weed.POS.sale.tax_sale, 10).toFixed(2));
	$('.pos-checkout-sum').html(parseFloat(Weed.POS.sale.due, 10).toFixed(2));

	if (Weed.POS.sale.due <= 0) {
		$('.pos-checkout-sum').parent().css('color', '');
		$('#pos-terminal-cmd-wrap button').attr('disabled', 'disabled');
	} else if (Weed.POS.sale.due > 0) {
		$('.pos-checkout-sum').parent().css('color', '#f00000');
		$('#pos-terminal-cmd-wrap button').removeAttr('disabled');
	}

	Weed.POS.push($('#psi-form').serializeArray());

}

$(function() {

	// Click the Cancel Button
	$('#pos-shop-redo').on('click touchend', function(e) {
		$(document.body).empty();
		$(document.body).css({
			'background': '#101010',
			'color': '#eeeeee',
		});
		$(document.body).html('<h1 style="margin:5em; text-align:center;"><i class="fas fa-sync fa-spin"></i> Loading...</h1>');
		// var $f = $('<form action="/pos" method="post"><input name="a" type="hidden" value="open"></form>');
		// $(document.body).append($f);
		// $f.submit();
		window.location.reload();
		return false;
	});

	// Attach Handler to Payment Button
	$('#pos-shop-next').on('click', function(e) {

		$('#pp-cash-pay').val('0.00');

		ppFormUpdate();

	});

	/**
		An Item Size has Changed
	*/
	$(document).on('change', '.psi-item-size', function(e) {

		console.log('item-size!change');

		var i = $(this).data('id');
		var q = $(this).val();
		var r = $('#inv-item-' + i).data('price');
		var p = q * r;

		$('#psi-item-' + i + '-sale').html(p.toFixed(2));

		if (q <= 0) {
			$('#psi-item-' + i).remove();
		}

		chkSaleCost();
	});

});
