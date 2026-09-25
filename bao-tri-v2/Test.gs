/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * SCRIPT TEST ĐỘC LẬP — chạy bằng dữ liệu giả, KHÔNG đọc/ghi bất kỳ sheet nào.
 *
 * Chạy: menu 🔧 Bảo trì → "🧪 Chạy test logic", hoặc Run hàm chayTest() trong editor.
 * Dùng để kiểm tra lại logic ca / lịch trực / lọc danh bạ mỗi khi sửa code,
 * trước khi deploy lên bản đang chạy thật.
 */

// ============================================================================
// Khung assert tối giản
// ============================================================================

function _kiemTra_(kq) {
  return {
    bang: function (ten, thucTe, mongDoi) {
      const a = JSON.stringify(thucTe);
      const b = JSON.stringify(mongDoi);
      if (a === b) kq.dat++;
      else kq.loi.push('✗ ' + ten + '\n    mong đợi: ' + b + '\n    thực tế : ' + a);
    },
  };
}

/** Date từ chuỗi 'yyyy-MM-ddTHH:mm', luôn hiểu là giờ Việt Nam. */
function _luc_(s) {
  return new Date(s + ':00+07:00');
}

/** Bảng ca giả — dựng từ chính hằng số CA_MAC_DINH nên test luôn cả giá trị seed. */
function _cauHinhCaGia_() {
  const map = {};
  CA_MAC_DINH.forEach(function (r) {
    map[r[0]] = { moTa: r[1], tu: gioSangPhut_(r[2]), den: gioSangPhut_(r[3]), coCaDem: r[4] };
  });
  return map;
}

// ============================================================================
// Bộ test
// ============================================================================

function chayTest() {
  const kq = { dat: 0, loi: [] };
  const t = _kiemTra_(kq);
  const cfg = _cauHinhCaGia_();

  // --- 1. Chuẩn hoá giờ ------------------------------------------------------
  t.bang('gioSangPhut 07:00', gioSangPhut_('07:00'), 420);
  t.bang('gioSangPhut 06:30', gioSangPhut_('06:30'), 390);
  t.bang('chuanHoaGio 7:5 sai định dạng', chuanHoaGio_('7:5'), null);
  t.bang('chuanHoaGio 7:05', chuanHoaGio_('7:05'), '07:05');

  // --- 2. Xác định ca --------------------------------------------------------
  // Dệt 07:00–18:00, có ca đêm.
  t.bang('DET 10:00 → ca ngày',
    xacDinhCa_('DET', _luc_('2026-08-03T10:00'), cfg),
    { ca: 'N', ngayCa: '2026-08-03', nhomCa: 'DET' });
  t.bang('DET 19:00 → ca đêm cùng ngày',
    xacDinhCa_('DET', _luc_('2026-08-03T19:00'), cfg),
    { ca: 'D', ngayCa: '2026-08-03', nhomCa: 'DET' });
  t.bang('DET 02:00 rạng sáng → ca đêm của HÔM TRƯỚC',
    xacDinhCa_('DET', _luc_('2026-08-04T02:00'), cfg),
    { ca: 'D', ngayCa: '2026-08-03', nhomCa: 'DET' });
  t.bang('DET đúng 18:00 → đã sang ca đêm',
    xacDinhCa_('DET', _luc_('2026-08-03T18:00'), cfg).ca, 'D');

  // Tổ điện đổi ca lúc 17:30 — lệch với giờ bộ phận Dệt.
  t.bang('TO_DIEN 17:45 → ca đêm',
    xacDinhCa_('TO_DIEN', _luc_('2026-08-03T17:45'), cfg).ca, 'D');
  t.bang('TO_DIEN 06:00 → ca đêm của hôm trước',
    xacDinhCa_('TO_DIEN', _luc_('2026-08-03T06:00'), cfg),
    { ca: 'D', ngayCa: '2026-08-02', nhomCa: 'TO_DIEN' });

  // Tổ cơ khí không làm đêm → ngoài giờ là không có ca nào.
  t.bang('TO_CO_KHI 08:00 → ca ngày',
    xacDinhCa_('TO_CO_KHI', _luc_('2026-08-03T08:00'), cfg).ca, 'N');
  t.bang('TO_CO_KHI 22:00 → không có ca',
    xacDinhCa_('TO_CO_KHI', _luc_('2026-08-03T22:00'), cfg).ca, null);

  // Nhóm ca lạ → rơi về MAC_DINH, không được văng lỗi.
  t.bang('Nhóm ca không tồn tại → dùng MAC_DINH',
    xacDinhCa_('KHONG_CO_NHOM_NAY', _luc_('2026-08-03T08:00'), cfg).ca, 'N');

  // Mốc chốt ngày ca — biên mà báo cáo ngày ngừng cộng dồn phiếu chưa đóng.
  // MAC_DINH vào ca 07:00 nên ngày 03/08 chốt lúc 07:00 ngày 04/08.
  t.bang('Ngày đã qua chốt ở giờ vào ca hôm sau',
    fmtGio_(mocChotNgayCa_('2026-08-03', cfg)), '07:00');
  t.bang('Mốc chốt rơi đúng vào ngày hôm sau',
    fmtNgay_(mocChotNgayCa_('2026-08-03', cfg)), '2026-08-04');
  // Ngày hôm nay: biên còn ở tương lai nên phải trả về giờ hiện tại, không được
  // chốt sớm — máy đang dừng thật thì phút dừng vẫn phải chạy.
  t.bang('Ngày hôm nay chưa chốt, lấy giờ hiện tại',
    mocChotNgayCa_(fmtNgay_(nowVN_()), cfg) <= nowVN_()
      && fmtNgay_(mocChotNgayCa_(fmtNgay_(nowVN_()), cfg)) === fmtNgay_(nowVN_()), true);
  t.bang('Ngày rỗng/sai định dạng → giờ hiện tại, không văng lỗi',
    fmtNgay_(mocChotNgayCa_('', cfg)), fmtNgay_(nowVN_()));

  // --- 3. Lịch trực ----------------------------------------------------------
  const lich = { TH01: { '03': 'N', '04': 'ND' } };
  t.bang('TH01 ngày 03 ca N → có trực', coTrucKhong_(lich, 'TH01', '2026-08-03', 'N'), true);
  t.bang('TH01 ngày 03 ca D → không trực', coTrucKhong_(lich, 'TH01', '2026-08-03', 'D'), false);
  t.bang('TH01 ngày 04 (ND) ca D → có trực', coTrucKhong_(lich, 'TH01', '2026-08-04', 'D'), true);
  t.bang('TH99 không có trong lịch', coTrucKhong_(lich, 'TH99', '2026-08-03', 'N'), false);
  t.bang('Lịch null (chưa tạo tháng)', coTrucKhong_(null, 'TH01', '2026-08-03', 'N'), false);
  t.bang('thangCuaNgay', thangCuaNgay_('2026-08-03'), '08/2026');

  // --- 4. Lọc chuyên môn / bộ phận -------------------------------------------
  t.bang('Thợ điện + lỗi điện', hopChuyenMon_('DIEN', 'DIEN'), true);
  t.bang('Thợ điện + lỗi cơ khí', hopChuyenMon_('DIEN', 'CO_KHI'), false);
  t.bang('Thợ CA_HAI + lỗi cơ khí', hopChuyenMon_('CA_HAI', 'CO_KHI'), true);
  t.bang('Lỗi KHONG_RO khớp mọi thợ', hopChuyenMon_('DIEN', 'KHONG_RO'), true);
  t.bang('Phụ trách trống = mọi bộ phận', phuTrachBoPhan_('', 'DET'), true);
  t.bang('TAT_CA = mọi bộ phận', phuTrachBoPhan_('TAT_CA', 'SOI'), true);
  t.bang('Phụ trách DET, máy SOI', phuTrachBoPhan_('DET', 'SOI'), false);
  t.bang('Phụ trách nhiều bộ phận', phuTrachBoPhan_('DET,SOI', 'SOI'), true);

  // --- 5. Chuẩn hoá dữ liệu --------------------------------------------------
  t.bang('SĐT mất số 0 đầu được bù lại', chuanHoaSdt_(976337715), '0976337715');
  t.bang('SĐT có dấu chấm/cách', chuanHoaSdt_('0976.337.715'), '0976337715');
  t.bang('Gộp phụ tùng',
    gopPhuTung_([{ ten: 'Vòng bi 6204', soLuong: 2, dvt: 'cái' }, { ten: 'Dây curoa', soLuong: 1, dvt: 'sợi' }]),
    'Vòng bi 6204 x2 cái; Dây curoa x1 sợi');
  t.bang('Phụ tùng rỗng', gopPhuTung_([]), '');
  t.bang('Phụ tùng quá 5 dòng bị cắt',
    gopPhuTung_([1, 2, 3, 4, 5, 6, 7].map(function (i) { return { ten: 'P' + i }; })).split(';').length, 5);

  // --- 6. Danh bạ thợ — thang fallback 3 nấc ---------------------------------
  const dsTho = [
    { Ma_Tho: 'TH01', Ten_Tho: 'Hảo', Chuyen_Mon: 'DIEN', Nhom_Ca: 'TO_DIEN',
      So_Dien_Thoai: '0976337715', Bo_Phan_Phu_Trach: '', Hoat_Dong: true },
    { Ma_Tho: 'TH02', Ten_Tho: 'Dũng', Chuyen_Mon: 'CO_KHI', Nhom_Ca: 'DET',
      So_Dien_Thoai: '0976337715', Bo_Phan_Phu_Trach: 'DET', Hoat_Dong: true },
  ];
  // cauHinh: {} là bắt buộc — thiếu nó getOnDutyContacts_ sẽ tự đọc sheet Cau_Hinh
  // và bộ test mất tính chất "không đụng vào dữ liệu thật".
  function goi_(luc, lichThang, nhomLoi) {
    return getOnDutyContacts_('DET', nhomLoi || 'CO_KHI', _luc_(luc), {
      dsTho: dsTho, cauHinhCa: cfg, lichTheoThang: lichThang, cauHinh: {},
    });
  }

  // Nấc 1 — ban ngày, thợ cơ khí Dệt đang trực.
  const nac1 = goi_('2026-08-03T10:00', { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } });
  t.bang('Nấc 1 — mức cảnh báo', nac1.mucCanhBao, MUC_CANH_BAO.BINH_THUONG);
  t.bang('Nấc 1 — chỉ thợ đúng nghề', nac1.ds.map(function (x) { return x.tenTho; }), ['Dũng']);

  // Nấc 2 — 22h, tổ cơ khí không làm đêm, chỉ còn thợ điện trực.
  const nac2 = goi_('2026-08-03T22:00', { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } });
  t.bang('Nấc 2 — mức cảnh báo', nac2.mucCanhBao, MUC_CANH_BAO.NGOAI_CHUYEN_MON);
  t.bang('Nấc 2 — hiện thợ điện đang trực', nac2.ds.map(function (x) { return x.tenTho; }), ['Hảo']);

  // Nấc 3 — 22h, không ai đăng ký trực ca đêm.
  const nac3 = goi_('2026-08-03T22:00', { '08/2026': { TH01: { '03': 'N' }, TH02: { '03': 'N' } } });
  t.bang('Nấc 3 — mức cảnh báo', nac3.mucCanhBao, MUC_CANH_BAO.KHONG_CO_THO);
  t.bang('Nấc 3 — danh sách rỗng', nac3.ds.length, 0);

  // Ngoại lệ — cả tháng chưa có lịch.
  const thieu = goi_('2026-08-03T10:00', {});
  t.bang('Thiếu lịch — mức cảnh báo', thieu.mucCanhBao, MUC_CANH_BAO.THIEU_LICH);
  t.bang('Thiếu lịch — hiện thợ đúng nghề', thieu.ds.map(function (x) { return x.tenTho; }), ['Dũng']);

  // Lỗi điện ban ngày → chỉ thợ điện, không lẫn thợ cơ khí.
  const dien = goi_('2026-08-03T10:00',
    { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } }, 'DIEN');
  t.bang('Lỗi điện — chỉ thợ điện', dien.ds.map(function (x) { return x.tenTho; }), ['Hảo']);

  // --- 7. Số khẩn cấp --------------------------------------------------------
  const chKhan = { SDT_KHAN_CAP: '0794964115' };
  function goiKhan_(luc, lichThang) {
    return getOnDutyContacts_('DET', 'CO_KHI', _luc_(luc), {
      dsTho: dsTho, cauHinhCa: cfg, lichTheoThang: lichThang, cauHinh: chKhan,
    });
  }

  // Không ai trực → vẫn phải còn đúng số khẩn cấp để gọi.
  const khanRong = goiKhan_('2026-08-03T22:00',
    { '08/2026': { TH01: { '03': 'N' }, TH02: { '03': 'N' } } });
  t.bang('Khẩn cấp — mức cảnh báo vẫn là KHONG_CO_THO',
    khanRong.mucCanhBao, MUC_CANH_BAO.KHONG_CO_THO);
  t.bang('Khẩn cấp — có đúng 1 số', khanRong.ds.length, 1);
  t.bang('Khẩn cấp — đúng số', khanRong.ds[0].soDienThoai, '0794964115');
  t.bang('Khẩn cấp — có cờ riêng', khanRong.ds[0].khanCap, true);

  // Có thợ trực → số khẩn cấp phải nằm CUỐI, không chen lên trước thợ.
  const khanNac1 = goiKhan_('2026-08-03T10:00',
    { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } });
  t.bang('Khẩn cấp — xếp cuối danh sách',
    khanNac1.ds.map(function (x) { return x.tenTho; }), ['Dũng', 'Số khẩn cấp']);

  // Không khai số → không có dòng thừa nào.
  t.bang('Không khai số khẩn cấp → không thêm gì',
    goi_('2026-08-03T10:00', { '08/2026': { TH01: { '03': 'ND' }, TH02: { '03': 'N' } } }).ds.length, 1);

  // --- 8. Tách KPI đáp ứng khi chồng việc ------------------------------------
  function _phieu_(o) {
    const v = new Array(HEADER_SU_CO.length).fill('');
    Object.keys(o).forEach(function (k) { v[COT[k]] = o[k]; });
    return { dong: 0, v: v };
  }

  // Kịch bản gốc: máy 1 và máy 2 cùng hỏng 9:00. Thợ nhận máy 1 lúc 9:02,
  // xong 9:30, rồi nhận máy 2 lúc 9:32.
  const viecCu = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Bao: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:02'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:30'),
  });
  const chong = tinhDapUng_([viecCu], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Chồng việc — chờ do thợ bận', chong.cho, 30);
  t.bang('Chồng việc — đáp ứng THỰC chỉ 2 phút', chong.thuc, 2);
  t.bang('Chồng việc — tổng vẫn bằng Phut_Tiep_Nhan', chong.cho + chong.thuc, 32);

  // Thợ rảnh hoàn toàn → toàn bộ thời gian là đáp ứng thực.
  const ranh = tinhDapUng_([], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:12'));
  t.bang('Thợ rảnh — không có chờ', ranh.cho, 0);
  t.bang('Thợ rảnh — đáp ứng thực = toàn bộ', ranh.thuc, 12);

  // Việc cũ đã xong TRƯỚC khi máy này báo hỏng → không được tính là bận.
  const cuXongTruoc = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T08:10'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T08:50'),
  });
  const khongDinh = tinhDapUng_([cuXongTruoc], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Việc cũ xong trước khi báo → không tính bận', khongDinh.cho, 0);
  t.bang('Việc cũ xong trước khi báo → đáp ứng thực đủ 32', khongDinh.thuc, 32);

  // Đang ôm việc dở mà vẫn nhận thêm → coi như bận tới tận lúc nhận.
  const dangOm = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.DANG_XU_LY,
    Thoi_Gian_Nhan: _luc_('2026-08-03T08:40'),
  });
  const om = tinhDapUng_([dangOm], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Đang ôm việc — đếm được chồng việc', om.chongViec, 1);
  t.bang('Đang ôm việc — toàn bộ tính là chờ', om.cho, 32);
  t.bang('Đang ôm việc — đáp ứng thực bằng 0', om.thuc, 0);

  // Việc của thợ KHÁC không được ảnh hưởng tới KPI của thợ này.
  const cuaThoKhac = _phieu_({
    Ma_Su_Co: 'SC-9', Ma_Tho: 'TH01', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:02'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:30'),
  });
  const khac = tinhDapUng_([cuaThoKhac], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Việc thợ khác không tính vào', khac.cho, 0);

  // --- 8b. KPI đáp ứng bản cộng dồn đoạn bận ---------------------------------
  // Ca then chốt, bộ test cũ KHÔNG phủ: thợ bận thành HAI đoạn rời. Cách cũ lấy
  // mốc rảnh muộn nhất nên nuốt luôn khoảng rảnh xen giữa; cách mới cộng dồn.
  const banDoan1 = _phieu_({
    Ma_Su_Co: 'SC-A', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T08:50'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:10'),
  });
  const banDoan2 = _phieu_({
    Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:30'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:50'),
  });
  const haiDoan = [banDoan1, banDoan2];
  const bao10 = _luc_('2026-08-03T09:00');
  const nhan10 = _luc_('2026-08-03T10:00');

  const roi = phutBanTrongCho_(haiDoan, 'TH02', 'SC-2', bao10, nhan10);
  t.bang('Hai đoạn bận rời — bận thực tế 10 + 20', roi.phutBan, 30);
  t.bang('Hai đoạn bận rời — đếm đúng 2 đoạn', roi.soDoan, 2);

  // Cùng dữ liệu, cách cũ chỉ tính thợ 10 phút — chênh 20 phút rảnh xen giữa.
  const cachCu = tinhDapUng_(haiDoan, 'TH02', 'SC-2', bao10, nhan10);
  t.bang('Cách cũ miễn trừ rộng hơn — đây là lý do phải vá', cachCu.thuc, 10);

  const phieuRoi = _phieu_({
    Ma_Su_Co: 'SC-2', Ma_Tho: 'TH02', Thoi_Gian_Bao: bao10, Thoi_Gian_Nhan: nhan10,
  }).v;
  const kRoi = kpiThoChoPhieu_(haiDoan, phieuRoi, 0);
  t.bang('Hai đoạn bận rời — KPI thợ 30 phút', kRoi.phutKpi, 30);
  t.bang('Đáp ứng = bận thực tế + KPI thợ', kRoi.phutBan + kRoi.phutKpi, 60);

  // Ca một đoạn bận TRÙM QUA lúc máy này báo hỏng: hai cách phải ra ĐÚNG cùng
  // con số, nếu không là đã lặng lẽ đổi nghĩa toàn bộ dữ liệu cũ.
  const phieuMotDoan = _phieu_({
    Ma_Su_Co: 'SC-2', Ma_Tho: 'TH02',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:00'), Thoi_Gian_Nhan: _luc_('2026-08-03T09:32'),
  }).v;
  const banTrum = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T08:50'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:30'),
  });
  const kTrum = kpiThoChoPhieu_([banTrum], phieuMotDoan, 0);
  t.bang('Một đoạn bận trùm đầu — KPI khớp y hệt cách cũ',
    kTrum.phutKpi,
    tinhDapUng_([banTrum], 'TH02', 'SC-2',
      _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32')).thuc);
  t.bang('Một đoạn bận trùm đầu — chỉ 1 đoạn', kTrum.soDoan, 1);

  // Nhưng nếu thợ nhận việc cũ SAU lúc máy này báo hỏng thì hai cách lệch nhau:
  // `viecCu` được nhận lúc 09:02, máy này báo 09:00 — hai phút 09:00–09:02 thợ
  // chưa cầm việc nào cả. Cách cũ gộp luôn vào "bận" (KPI 2 phút), cách mới trả
  // hai phút đó về cho thợ (KPI 4 phút). Cách mới đúng: máy đã nằm chờ trong khi
  // thợ còn rảnh. Đây là chỗ thứ hai mà cách cũ rộng tay, ngoài ca nhiều đoạn.
  const kSauBao = kpiThoChoPhieu_([viecCu], phieuMotDoan, 0);
  t.bang('Nhận việc cũ sau lúc báo — cách cũ chỉ tính thợ 2 phút', chong.thuc, 2);
  t.bang('Nhận việc cũ sau lúc báo — cách mới tính đủ 4 phút', kSauBao.phutKpi, 4);

  // Thợ rảnh hẳn → không có đoạn nào, KPI bằng trọn thời gian chờ.
  const kRanh = kpiThoChoPhieu_([], phieuMotDoan, 0);
  t.bang('Thợ rảnh — không đoạn bận nào', kRanh.soDoan, 0);
  t.bang('Thợ rảnh — KPI bằng cả 32 phút', kRanh.phutKpi, 32);

  // Đang ôm việc dở lúc nhận → bận suốt cửa sổ → KPI bằng 0.
  const kOm = kpiThoChoPhieu_([dangOm], phieuMotDoan, 0);
  t.bang('Đang ôm việc dở — KPI bằng 0', kOm.phutKpi, 0);

  // Việc chung tính là bận; bảo trì thì không — giữ đúng như cách cũ.
  // Khai riêng phiếu ở đây, KHÔNG dùng lại `lapCamera` của mục 9: nó khai bằng
  // const ở phía dưới, gọi lên trên là dính "Cannot access before initialization".
  const camera8b = _phieu_({
    Ma_Su_Co: 'CV-8B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T11:00'),
  });
  t.bang('Việc chung vẫn miễn trừ cho thợ',
    phutBanTrongCho_([camera8b], 'TH02', 'SC-2',
      _luc_('2026-08-03T09:30'), _luc_('2026-08-03T11:02')).phutBan, 90);

  const baoTri8b = _phieu_({
    Ma_Su_Co: 'BT-8B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Loai_Phieu: LOAI_PHIEU.BAO_TRI,
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:10'),
  });
  t.bang('Bảo trì vẫn không làm thợ "bận"',
    phutBanTrongCho_([baoTri8b], 'TH02', 'SC-2', bao10, nhan10).phutBan, 0);

  // Tính lúc nhận (phiếu kia còn mở) và tính lại sau này (phiếu kia đã đóng muộn
  // hơn) phải cho CÙNG kết quả — nếu lệch thì backfill sẽ viết đè số sai lên số
  // đã ghi tại chỗ.
  const conMo = _phieu_({
    Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.DANG_XU_LY,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:30'),
  });
  const dongMuon = _phieu_({
    Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:30'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:20'),
  });
  t.bang('Tính lúc nhận và tính lại sau cho cùng số phút',
    [phutBanTrongCho_([banDoan1, conMo], 'TH02', 'SC-2', bao10, nhan10).phutBan,
      phutBanTrongCho_([banDoan1, dongMuon], 'TH02', 'SC-2', bao10, nhan10).phutBan],
    [40, 40]);

  // Phiếu nào bị loại khỏi KPI, và vì sao.
  t.bang('Việc chung không vào KPI',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'CV-1', Ma_Tho: 'TH02',
      Loai_Phieu: LOAI_PHIEU.CONG_VIEC }).v, 0).apDung, 'KHONG — phiếu CONG_VIEC');
  t.bang('Bảo trì không vào KPI',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'BT-1', Ma_Tho: 'TH02',
      Loai_Phieu: LOAI_PHIEU.BAO_TRI }).v, 0).apDung, 'KHONG — phiếu BAO_TRI');
  t.bang('Phiếu chưa ai nhận không vào KPI',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'SC-3' }).v, 0).apDung,
    'KHONG — chưa ai nhận');
  t.bang('Thiếu mốc giờ thì không chấm',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'SC-3', Ma_Tho: 'TH02',
      Thoi_Gian_Bao: bao10 }).v, 0).apDung, 'KHONG — thiếu mốc giờ');
  t.bang('Phiếu bị loại thì để trống ô phút, không ghi 0',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'SC-3' }).v, 0).phutKpi, '');

  // Ngưỡng: để trống thì không chấm đạt/không đạt.
  t.bang('Chưa chốt ngưỡng — không chấm đạt', kRoi.datNguong, '');
  t.bang('KPI 30 phút, ngưỡng 30 → ĐẠT',
    kpiThoChoPhieu_(haiDoan, phieuRoi, 30).datNguong, 'DAT');
  t.bang('KPI 30 phút, ngưỡng 15 → KHÔNG ĐẠT',
    kpiThoChoPhieu_(haiDoan, phieuRoi, 15).datNguong, 'KHONG_DAT');

  // Phân vị dùng thứ hạng gần nhất — luôn trả về một giá trị có thật.
  t.bang('Phân vị — trung vị của 5 số', phanVi_([2, 4, 6, 8, 10], 0.5), 6);
  t.bang('Phân vị — P90 lấy số lớn nhất trong 5 số', phanVi_([2, 4, 6, 8, 10], 0.9), 10);
  t.bang('Phân vị — mảng rỗng trả rỗng', phanVi_([], 0.5), '');
  t.bang('Tỷ lệ — mẫu 0 trả rỗng chứ không phải 0%', tyLe_(0, 0), '');
  t.bang('Tỷ lệ — 3/4 thành 75', tyLe_(3, 4), 75);

  // --- 8c. Trang Tom_Tat — kỳ liền trước và mức tăng giảm --------------------
  // Sai biên ngày ở đây là so nhầm kỳ mà bảng vẫn hiện ra đẹp đẽ, không ai thấy.
  t.bang('Lùi 1 ngày qua đầu tháng', dichNgay_('2026-08-01', -1), '2026-07-31');
  t.bang('Lùi 1 ngày vào tháng 2 (2026 không nhuận)',
    dichNgay_('2026-03-01', -1), '2026-02-28');
  t.bang('Tiến 1 ngày qua cuối năm', dichNgay_('2026-12-31', 1), '2027-01-01');
  t.bang('Ngày hỏng thì trả rỗng', dichNgay_('linh tinh', -1), '');

  // Kỳ tháng 8 (31 ngày) → kỳ trước phải là trọn tháng 7, không phải 30 ngày.
  const soNgayT8 = dsNgayTrongKy_('2026-08-01', '2026-08-31').length;
  const denT7 = dichNgay_('2026-08-01', -1);
  t.bang('Kỳ trước của tháng 8 là trọn tháng 7',
    [dichNgay_(denT7, -(soNgayT8 - 1)), denT7], ['2026-07-01', '2026-07-31']);

  // Hướng tốt/xấu: downtime giảm là tốt, tỷ lệ đạt tăng mới là tốt.
  t.bang('Giờ dừng giảm → tốt', soSanhKy_(50, 62, true, ' giờ').tot, true);
  t.bang('Giờ dừng tăng → xấu', soSanhKy_(70, 62, true, ' giờ').tot, false);
  t.bang('Tỷ lệ đạt tăng → tốt', soSanhKy_(80, 71, false, '%').tot, true);
  t.bang('Kỳ trước trống thì không kết luận',
    soSanhKy_(50, '', true, ' giờ'), { chu: 'kỳ trước chưa có số liệu', tot: null });
  t.bang('Không đổi thì không tô màu',
    soSanhKy_(50, 50, true, ' giờ'), { chu: 'không đổi so với kỳ trước', tot: null });
  t.bang('Có nêu rõ tăng hay giảm bao nhiêu',
    soSanhKy_(50, 62, true, ' giờ').chu, '▼ giảm 12 giờ so với kỳ trước');

  // --- 9. Công việc chung ----------------------------------------------------
  t.bang('Ô Loai_Phieu trống → hiểu là phiếu sự cố',
    laCongViec_(_phieu_({ Ma_Su_Co: 'SC-1' }).v), false);
  t.bang('Loai_Phieu = CONG_VIEC',
    laCongViec_(_phieu_({ Loai_Phieu: LOAI_PHIEU.CONG_VIEC }).v), true);

  // Đây là lý do để việc chung nằm chung sheet Su_Co: thợ lắp camera 9h–11h thì
  // máy hỏng lúc 9h30 phải chờ, nhưng KHÔNG được trừ vào KPI đáp ứng của thợ.
  const lapCamera = _phieu_({
    Ma_Su_Co: 'CV-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T11:00'),
  });
  const banViecChung = tinhDapUng_([lapCamera], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:30'), _luc_('2026-08-03T11:02'));
  t.bang('Việc chung cũng tính là thợ bận', banViecChung.cho, 90);
  t.bang('Việc chung — đáp ứng thực chỉ 2 phút', banViecChung.thuc, 2);

  // --- 10. Bảo trì hằng ngày -------------------------------------------------
  t.bang('Loai_Phieu = BAO_TRI',
    laBaoTri_(_phieu_({ Loai_Phieu: LOAI_PHIEU.BAO_TRI }).v), true);
  t.bang('Ô trống vẫn là sự cố', laSuCo_(_phieu_({ Ma_Su_Co: 'SC-1' }).v), true);

  // Điểm mấu chốt: bảo trì hằng ngày KHÔNG được tính là thợ bận. Phiếu bảo trì
  // cố ý để trống Thoi_Gian_Nhan nên tinhDapUng_ phải bỏ qua hoàn toàn.
  const baoTri = _phieu_({
    Ma_Su_Co: 'BT-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
    Loai_Phieu: LOAI_PHIEU.BAO_TRI,
    Thoi_Gian_Bao: _luc_('2026-08-03T09:10'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:10'),
  });
  const khongBan = tinhDapUng_([baoTri], 'TH02', 'SC-2',
    _luc_('2026-08-03T09:00'), _luc_('2026-08-03T09:32'));
  t.bang('Bảo trì không làm thợ "bận"', khongBan.cho, 0);
  t.bang('Bảo trì không che KPI đáp ứng', khongBan.thuc, 32);
  t.bang('Bảo trì không tính là chồng việc', khongBan.chongViec, 0);

  // Đếm theo ca của đúng thợ.
  const dsBT = [
    baoTri,
    _phieu_({ Ma_Su_Co: 'BT-2', Ma_Tho: 'TH02', Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ngay_Ca: '2026-08-03' }),
    _phieu_({ Ma_Su_Co: 'BT-3', Ma_Tho: 'TH02', Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ngay_Ca: '2026-08-04' }),
    _phieu_({ Ma_Su_Co: 'BT-4', Ma_Tho: 'TH01', Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ngay_Ca: '2026-08-03' }),
    _phieu_({ Ma_Su_Co: 'BT-5', Ma_Tho: 'TH02', Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ngay_Ca: '2026-08-03',
      Ten_May: 'Tra dầu trục chính', Bo_Phan: '4T-05' }),
  ];
  t.bang('Đếm bảo trì đúng thợ + đúng ngày ca',
    demBaoTriTrongCa_(dsBT, 'TH02', '2026-08-03'), 2);
  t.bang('Danh sách bảo trì — mới nhất lên đầu, không lẫn thợ/ngày khác',
    dsBaoTriTrongCa_(dsBT, 'TH02', '2026-08-03').map(function (m) { return m.maSuCo; }),
    ['BT-5', 'BT-2']);
  t.bang('Mục bảo trì rút gọn đúng trường',
    dsBaoTriTrongCa_(dsBT, 'TH02', '2026-08-03')[0].noiDung, 'Tra dầu trục chính');

  // Nội dung việc nằm ở Mo_Ta; Ten_May để trống vì không gắn máy nào.
  t.bang('Bảo trì lấy nội dung từ Mo_Ta',
    mucBaoTri_(_phieu_({ Loai_Phieu: LOAI_PHIEU.BAO_TRI, Mo_Ta: 'Tra dầu' }).v).noiDung,
    'Tra dầu');
  t.bang('Bảo trì lùi về Ten_May cho phiếu ghi trước khi đổi',
    mucBaoTri_(_phieu_({ Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ten_May: 'Siết ốc' }).v).noiDung,
    'Siết ốc');

  // --- 11. Xuất báo cáo theo form Excel --------------------------------------
  t.bang('Tách phụ tùng chuẩn',
    tachPhuTung_('Vòng bi 6204 x2 cái; Dây curoa x1 sợi'),
    [{ ten: 'Vòng bi 6204', sl: '2', dvt: 'cái' }, { ten: 'Dây curoa', sl: '1', dvt: 'sợi' }]);
  t.bang('Tách phụ tùng không có ĐVT',
    tachPhuTung_('Ắc kẹp x3'), [{ ten: 'Ắc kẹp', sl: '3', dvt: '' }]);
  t.bang('Tách phụ tùng rỗng', tachPhuTung_(''), []);
  t.bang('Nhãn ca', [nhanCa_('N'), nhanCa_('D'), nhanCa_('NGOAI_GIO')], ['Ngày', 'Đêm', '']);

  const phieuXong = _phieu_({
    Ten_Tho: 'Dũng', Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Dung_May: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:32'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:00'),
    Phut_Cho_Tho_Ban: 30, Phut_Dap_Ung_Thuc: 2, So_Chong_Viec: 0,
  }).v;
  t.bang('Phút dừng máy = kết thúc − lúc máy dừng', phutDungMay_(phieuXong), 60);
  t.bang('Trạng thái đáp ứng khi có chờ', trangThaiDapUng_(phieuXong), 'CHỜ THỢ RẢNH');

  // Phiếu cũ chưa có Thoi_Gian_Dung_May → "Bắt đầu hư" lùi về giờ công nhân báo,
  // cột này không được để trống.
  const phieuCu = _phieu_({
    Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:10'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:00'),
  }).v;
  t.bang('Bắt đầu hư lùi về giờ báo', gioCuaMoc_(mocBatDauHu_(phieuCu)), '09:10');
  t.bang('Downtime tính từ giờ báo khi thiếu mốc dừng', phutDungMay_(phieuCu), 50);

  // Máy còn chạy → có giờ bắt đầu hư nhưng KHÔNG tính downtime.
  const conChay = _phieu_({
    Trang_Thai_May: 'DANG_CHAY',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:10'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:00'),
  }).v;
  t.bang('Máy còn chạy vẫn có giờ bắt đầu hư', gioCuaMoc_(mocBatDauHu_(conChay)), '09:10');
  t.bang('Máy còn chạy → downtime để trống', phutDungMay_(conChay), '');

  t.bang('Nhận diện bộ phận Dệt',
    [laBoPhanDet_('DET'), laBoPhanDet_('Dệt'), laBoPhanDet_('dệt'), laBoPhanDet_('SOI')],
    [true, true, true, false]);

  const chuaAiNhan = _phieu_({ Ma_Su_Co: 'SC-9' }).v;
  t.bang('Chưa ai nhận', trangThaiDapUng_(chuaAiNhan), 'CHƯA NHẬP NGƯỜI XỬ LÝ');
  t.bang('Không rõ trạng thái máy → không tính downtime', phutDungMay_(chuaAiNhan), '');

  const chongViecPhieu = _phieu_({
    Ten_Tho: 'Dũng',
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:32'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T10:00'),
    So_Chong_Viec: 1,
  }).v;
  t.bang('Trạng thái khi chồng việc',
    trangThaiDapUng_(chongViecPhieu), 'CHỒNG VIỆC / KIỂM TRA DỮ LIỆU');

  // 29 cột đầu phải khớp biểu mẫu gốc; các cột sau đó là phần thêm ngoài form —
  // 30 "Loại", rồi 31–32 là hai cột KPI (09/2026). Test này canh đúng chỗ đó:
  // cột thứ 29 mà xê dịch là biểu mẫu gửi sếp đã lệch.
  t.bang('Cột thứ 29 vẫn là cột cuối của biểu mẫu',
    HEADER_DATA_GOC[28], 'Trạng thái đáp ứng');
  t.bang('Data_Goc = 29 cột form + Loại + 2 cột KPI', HEADER_DATA_GOC.length, 32);
  t.bang('Hai cột thêm sau cùng là KPI',
    [HEADER_DATA_GOC[30], HEADER_DATA_GOC[31]], ['KPI thợ\n(Phút)', 'Số đoạn bận']);
  t.bang('Số cột Nhật ký bảo trì đúng biểu mẫu', HEADER_NHAT_KY_DET.length, 10);

  // Việc chung và bảo trì vào Data_Goc nhưng không mang chỉ số đáp ứng.
  const viecChungPhieu = _phieu_({
    Loai_Phieu: LOAI_PHIEU.CONG_VIEC, Ten_Tho: 'Hảo',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T11:00'),
  }).v;
  t.bang('Việc chung — nhãn loại', nhanLoaiPhieu_(viecChungPhieu), 'Việc chung');
  t.bang('Việc chung — không có "bắt đầu hư"', mocBatDauHu_(viecChungPhieu), '');
  t.bang('Việc chung — trạng thái đáp ứng',
    trangThaiDapUng_(viecChungPhieu), 'KHÔNG ÁP DỤNG');
  t.bang('Việc chung — không tính downtime', phutDungMay_(viecChungPhieu), '');
  t.bang('Bảo trì — nhãn loại',
    nhanLoaiPhieu_(_phieu_({ Loai_Phieu: LOAI_PHIEU.BAO_TRI }).v), 'Bảo trì hằng ngày');

  // --- 12. Chặn spam ---------------------------------------------------------
  const bayGio = _luc_('2026-08-03T10:00').getTime();
  const dsSpam = [
    _phieu_({ Ma_May: '4T-01', Thoi_Gian_Bao: _luc_('2026-08-03T09:58') }),
    _phieu_({ Ma_May: '4T-01', Thoi_Gian_Bao: _luc_('2026-08-03T09:57') }),
    _phieu_({ Ma_May: '4T-01', Thoi_Gian_Bao: _luc_('2026-08-03T09:30') }), // ngoài cửa sổ
    _phieu_({ Ma_May: '6T-01', Thoi_Gian_Bao: _luc_('2026-08-03T09:59') }), // máy khác
  ];
  const cuaSo5Phut = bayGio - 5 * 60000;
  t.bang('Đếm phiếu trong 5 phút của đúng máy đó',
    demPhieuGanDayCuaMay_(dsSpam, '4T-01', cuaSo5Phut), 2);
  t.bang('Không tính máy khác',
    demPhieuGanDayCuaMay_(dsSpam, '6T-01', cuaSo5Phut), 1);
  t.bang('Không phân biệt hoa thường mã máy',
    demPhieuGanDayCuaMay_(dsSpam, '4t-01', cuaSo5Phut), 2);
  t.bang('Mở rộng cửa sổ thì đếm cả phiếu cũ',
    demPhieuGanDayCuaMay_(dsSpam, '4T-01', bayGio - 60 * 60000), 3);

  t.bang('Cấu hình trống → dùng mặc định', soCauHinh_('', 5), 5);
  t.bang('Cấu hình không phải số → dùng mặc định', soCauHinh_('abc', 5), 5);
  t.bang('Cấu hình 0 = tắt, phải giữ đúng 0', soCauHinh_('0', 5), 0);
  t.bang('Cấu hình hợp lệ được dùng', soCauHinh_('10', 5), 10);

  // --- 13. Bung danh mục theo dải --------------------------------------------
  const bung = bungDanhMuc_(DANH_MUC_MTX);
  t.bang('Tổng số máy MTX', bung.length, 64);
  t.bang('Mã đầu tiên', [bung[0].ma, bung[0].ten], ['1K01', 'Máy 1 kim 01']);
  t.bang('Mã cuối dải 1 kim', bung[44].ma, '1K45');
  t.bang('Bắt đầu dải Kansai', [bung[45].ma, bung[45].ten], ['KS01', 'Máy Kansai 01']);
  t.bang('Mã cuối cùng',
    [bung[63].ma, bung[63].ten], ['MCQTX02', 'Máy cắt quai túi xách 02']);
  t.bang('Không có mã nào trùng nhau',
    Object.keys(bung.reduce(function (m, x) { m[x.ma] = 1; return m; }, {})).length, 64);
  t.bang('Số luôn có 2 chữ số', bung[4].ma, '1K05');

  // --- 14. Dừng máy không do hư hỏng -----------------------------------------
  t.bang('Nhận diện phiếu dừng máy',
    laDungMay_(_phieu_({ Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v), true);
  t.bang('Phiếu dừng máy KHÔNG bị tính là sự cố',
    laSuCo_(_phieu_({ Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v), false);
  t.bang('Nhãn loại phiếu dừng máy',
    nhanLoaiPhieu_(_phieu_({ Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v), 'Dừng máy (không hư)');

  // Khác việc chung và bảo trì: phiếu dừng máy PHẢI tính được downtime.
  const dungMay = _phieu_({
    Loai_Phieu: LOAI_PHIEU.DUNG_MAY, Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Dung_May: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:45'),
  }).v;
  t.bang('Dừng máy có mốc bắt đầu', gioCuaMoc_(mocBatDauHu_(dungMay)), '09:00');
  t.bang('Dừng máy tính được downtime', phutDungMay_(dungMay), 45);

  // Phiếu dừng máy không có thợ nên không được ảnh hưởng KPI đáp ứng của ai.
  const dungMayCuaTho = _phieu_({
    Loai_Phieu: LOAI_PHIEU.DUNG_MAY, Ma_Tho: '',
    Thoi_Gian_Dung_May: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:45'),
  });
  t.bang('Dừng máy không làm thợ "bận"',
    tinhDapUng_([dungMayCuaTho], 'TH02', 'SC-9',
      _luc_('2026-08-03T09:10'), _luc_('2026-08-03T09:40')).cho, 0);

  // Tổng phút dừng: phiếu chưa đóng vẫn phải được tính tới hiện tại.
  t.bang('Tổng phút dừng của phiếu đã đóng', tongPhutDung_([dungMay]), 45);
  t.bang('Phiếu chưa có mốc dừng thì bỏ qua',
    tongPhutDung_([_phieu_({ Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v]), 0);

  // --- 14b. Gọi kỹ thuật lúc máy đang dừng (phiếu HT-) -----------------------
  // Loại phiếu này sinh ra để giữ đúng hai con số: "số lần máy hỏng" không được
  // phồng lên vì đổi mặt hàng, và "phút máy dừng" không được đếm hai lần.
  const hoTro = _phieu_({
    Loai_Phieu: LOAI_PHIEU.HO_TRO, Trang_Thai_May: 'DA_DUNG',
    Nhom_Loi: 'CO_KHI', Ma_Tho: 'TH02',
    Thoi_Gian_Bao: _luc_('2026-08-03T09:00'),
    Thoi_Gian_Nhan: _luc_('2026-08-03T09:12'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:45'),
  }).v;

  t.bang('Nhận diện phiếu gọi kỹ thuật', laHoTro_(hoTro), true);
  t.bang('Gọi kỹ thuật KHÔNG bị tính là sự cố', laSuCo_(hoTro), false);
  t.bang('Ô Loai_Phieu lạ vẫn rơi về SU_CO, không rơi nhầm sang HO_TRO',
    loaiPhieu_(_phieu_({ Loai_Phieu: 'LOAI_LA' }).v), LOAI_PHIEU.SU_CO);
  t.bang('Nhãn loại phiếu gọi kỹ thuật',
    nhanLoaiPhieu_(hoTro), 'Gọi kỹ thuật (máy đang dừng)');

  // Hai phép chặn downtime. Phiếu DM- mở song song mới là phiếu đo khoảng dừng;
  // nếu một trong hai hàm dưới đây trả về số thì phút máy nằm im bị cộng hai lần.
  t.bang('Gọi kỹ thuật không có mốc "máy hư"', mocBatDauHu_(hoTro), '');
  t.bang('Gọi kỹ thuật không tính downtime', phutDungMay_(hoTro), '');
  t.bang('Gọi kỹ thuật không sinh khoảng dừng ở tỉ lệ hiệu dụng',
    khoangDungCuaPhieu_(hoTro, _luc_('2026-08-03T10:00')), null);
  t.bang('Dù Trang_Thai_May vẫn ghi DA_DUNG',
    String(hoTro[COT.Trang_Thai_May]), 'DA_DUNG');

  // Nhưng VẪN đo đáp ứng và VẪN là việc của thợ — chủ dự án chốt tính chung một
  // con số với sự cố, 11/09/2026.
  t.bang('Gọi kỹ thuật CÓ vào KPI đáp ứng',
    kpiThoChoPhieu_([], hoTro, 0).apDung, 'CO');
  t.bang('Dừng máy thì KHÔNG vào KPI',
    kpiThoChoPhieu_([], _phieu_({ Ma_Su_Co: 'DM-1', Ma_Tho: 'TH02',
      Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v, 0).apDung, 'KHONG — phiếu DUNG_MAY');
  t.bang('Trạng thái đáp ứng không còn là KHÔNG ÁP DỤNG',
    trangThaiDapUng_(_phieu_({ Loai_Phieu: LOAI_PHIEU.HO_TRO, Ten_Tho: 'Nhân',
      Thoi_Gian_Nhan: _luc_('2026-08-03T09:12'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-03T09:45') }).v), 'THỢ RẢNH');
  t.bang('Vào trung bình đáp ứng chung với sự cố',
    tbDapUngSuCo_([_phieu_({ Loai_Phieu: LOAI_PHIEU.HO_TRO,
      Phut_Tiep_Nhan: 12 }).v]), 12);

  // Nhánh đếm theo loại phiếu kết thúc bằng "còn lại là bảo trì". Thiếu một
  // nhánh riêng là phiếu HT- bị đếm thành bảo trì mà không có lỗi nào để thấy.
  const gomHT = gomTheoMayTho_([hoTro]);
  t.bang('Không bị đếm nhầm thành bảo trì', gomHT.tong.soBaoTri, 0);
  t.bang('Được đếm riêng', gomHT.tong.soHoTro, 1);
  t.bang('Không cộng vào số lần hỏng', gomHT.tong.soSuCo, 0);

  // Mô tả nối hai phiếu với nhau bằng mã DM-, không thêm cột mới vào Su_Co.
  t.bang('Mô tả gom đủ lý do dừng, ghi chú và mã phiếu dừng',
    ghepMoTaHoTro_({ maSuCo: 'DM-0308-002', moTa: 'Đổi mặt hàng' }, 'chỉnh lại cữ'),
    'Gọi kỹ thuật — máy đang dừng — Đổi mặt hàng — chỉnh lại cữ — phiếu DM-0308-002');
  t.bang('Không gõ gì thêm thì bỏ luôn phần đó',
    ghepMoTaHoTro_({ maSuCo: 'DM-0308-002', moTa: 'Đổi mặt hàng' }, ''),
    'Gọi kỹ thuật — máy đang dừng — Đổi mặt hàng — phiếu DM-0308-002');
  t.bang('Phiếu dừng không ghi lý do vẫn ra câu đọc được',
    ghepMoTaHoTro_({ maSuCo: 'DM-0308-002', moTa: '' }, ''),
    'Gọi kỹ thuật — máy đang dừng — phiếu DM-0308-002');

  // --- 15. Gom nhóm lý do dừng máy gõ tự do ----------------------------------
  t.bang('Lấy phần lý do trước dấu gạch',
    lyDoHienThi_('Thiếu chỉ — chờ kho cấp'), 'Thiếu chỉ');
  t.bang('Không có ghi chú thêm', lyDoHienThi_('Mất điện'), 'Mất điện');
  t.bang('Bỏ trống thì báo rõ', lyDoHienThi_(''), '(không ghi lý do)');

  // Gõ khác nhau nhưng cùng nghĩa phải rơi vào một nhóm, nếu không bảng báo cáo
  // vỡ thành hàng chục dòng trùng ý.
  t.bang('Chuẩn hoá — khác hoa thường',
    chuanHoaLyDo_('Thiếu chỉ') === chuanHoaLyDo_('thiếu chỉ'), true);
  t.bang('Chuẩn hoá — mất dấu',
    chuanHoaLyDo_('Thiếu chỉ') === chuanHoaLyDo_('thieu chi'), true);
  t.bang('Chuẩn hoá — thừa khoảng trắng',
    chuanHoaLyDo_('Thiếu   chỉ') === chuanHoaLyDo_('Thiếu chỉ'), true);
  t.bang('Chuẩn hoá — chữ đ',
    chuanHoaLyDo_('Đợi kho') === chuanHoaLyDo_('doi kho'), true);
  t.bang('Lý do khác nhau vẫn tách nhóm',
    chuanHoaLyDo_('Thiếu chỉ') === chuanHoaLyDo_('Mất điện'), false);

  // --- 16. Thợ phụ trách nhiều bộ phận ---------------------------------------
  // Bộ phận nào chạy khác giờ thì khai thành BỘ PHẬN RIÊNG trong Ca_Lam_Viec,
  // không thêm cột giờ ca cho từng máy. Thợ nào lo nhiều bộ phận thì liệt kê
  // cách nhau dấu phẩy ở Bo_Phan_Phu_Trach.
  t.bang('Nhân M phụ trách cả MTX lẫn CMTD',
    [phuTrachBoPhan_('MTX,CMTD', 'CMTD'), phuTrachBoPhan_('MTX,CMTD', 'MTX'),
     phuTrachBoPhan_('MTX,CMTD', 'DET')], [true, true, false]);
  t.bang('Khoảng trắng quanh dấu phẩy không làm hỏng',
    phuTrachBoPhan_(' MTX , CMTD ', 'CMTD'), true);

  // --- 17. Xuất báo cáo theo khoảng ngày / bộ phận / thợ ----------------------
  t.bang('Ngày của phiếu lấy từ Ngay_Ca',
    ngayCuaPhieu_(_phieu_({ Ngay_Ca: '2026-08-10' }).v), '2026-08-10');
  t.bang('Thiếu Ngay_Ca thì lùi về giờ báo',
    ngayCuaPhieu_(_phieu_({ Thoi_Gian_Bao: _luc_('2026-08-10T23:30') }).v), '2026-08-10');
  t.bang('Không có mốc nào thì trả rỗng', ngayCuaPhieu_(_phieu_({}).v), '');

  const kyDs = [
    _phieu_({ Ma_Su_Co: 'SC-1', Ngay_Ca: '2026-08-09', Bo_Phan: 'MTX', Ten_Tho: 'Nhân M' }).v,
    _phieu_({ Ma_Su_Co: 'SC-2', Ngay_Ca: '2026-08-10', Bo_Phan: 'MTX', Ten_Tho: 'Nhân M' }).v,
    _phieu_({ Ma_Su_Co: 'SC-3', Ngay_Ca: '2026-08-14', Bo_Phan: 'MTX', Ten_Tho: 'Thiện' }).v,
    _phieu_({ Ma_Su_Co: 'SC-4', Ngay_Ca: '2026-08-15', Bo_Phan: 'MTX', Ten_Tho: 'Nhân M' }).v,
    _phieu_({ Ma_Su_Co: 'SC-5', Ngay_Ca: '2026-08-12', Bo_Phan: 'DET', Ten_Tho: 'Hảo' }).v,
    _phieu_({ Ma_Su_Co: 'DM-1', Ngay_Ca: '2026-08-12', Bo_Phan: 'MTX',
      Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v,
    _phieu_({ Ma_Su_Co: 'CV-1', Ngay_Ca: '2026-08-12', Bo_Phan: 'MTX',
      Loai_Phieu: LOAI_PHIEU.CONG_VIEC, Ten_Tho: 'Nhân M' }).v,
    _phieu_({ Ma_Su_Co: 'BT-1', Ngay_Ca: '2026-08-12', Bo_Phan: 'MTX',
      Loai_Phieu: LOAI_PHIEU.BAO_TRI, Ten_Tho: 'Nhân M' }).v,
  ];
  function _ma_(ds) { return ds.map(function (v) { return v[COT.Ma_Su_Co]; }); }

  // Mặc định: chỉ phiếu gắn với máy, hai đầu khoảng ngày đều LẤY.
  t.bang('Lọc kỳ 10–14/08, mặc định bỏ CV/BT',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14' })),
    ['SC-2', 'SC-3', 'SC-5', 'DM-1']);
  t.bang('Kèm việc chung và bảo trì',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14',
      kemViecChung: true })),
    ['SC-2', 'SC-3', 'SC-5', 'DM-1', 'CV-1', 'BT-1']);
  t.bang('Lọc bộ phận MTX bỏ được phiếu Dệt',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14',
      dsBoPhan: ['MTX'] })),
    ['SC-2', 'SC-3', 'DM-1']);
  t.bang('Lọc bộ phận không phân biệt hoa thường',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14',
      dsBoPhan: [' mtx '] })),
    ['SC-2', 'SC-3', 'DM-1']);
  // Lọc thợ thì phiếu dừng máy biến mất — nó không gắn thợ nào. Đây là hành vi
  // cố ý, hộp thoại có cảnh báo, và test này canh để không ai "sửa" nhầm.
  t.bang('Lọc thợ loại luôn phiếu dừng máy',
    _ma_(locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-10', denNgay: '2026-08-14',
      dsTho: ['Nhân M'] })),
    ['SC-2']);
  t.bang('Danh sách lọc rỗng = không lọc',
    locPhieuTheoKy_(kyDs, { tuNgay: '2026-08-01', denNgay: '2026-08-31',
      dsBoPhan: [], dsTho: [''], kemViecChung: true }).length, 8);

  // Cắt downtime theo ngày thật (cách B): phiếu tháo motor mở 10/08 09:00, lắp
  // xong 13/08 15:00 → mỗi ngày chỉ được tính phần của ngày đó.
  const motor = _phieu_({
    Ma_Su_Co: 'SC-M', Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Dung_May: _luc_('2026-08-10T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-13T15:00'),
  }).v;
  const kMotor = khoangDungMay_(motor, _luc_('2026-08-20T00:00'));
  t.bang('Ngày mở phiếu tính từ lúc dừng tới nửa đêm',
    phutDungTrongNgay_(kMotor, '2026-08-10'), 900);
  t.bang('Ngày giữa tính trọn 1440 phút',
    phutDungTrongNgay_(kMotor, '2026-08-11'), 1440);
  t.bang('Ngày đóng phiếu chỉ tính tới lúc máy chạy lại',
    phutDungTrongNgay_(kMotor, '2026-08-13'), 900);
  t.bang('Ngày ngoài khoảng dừng = 0',
    phutDungTrongNgay_(kMotor, '2026-08-14'), 0);
  t.bang('Không ngày nào vượt quá một ngày thật',
    ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13'].every(function (n) {
      return phutDungTrongNgay_(kMotor, n) <= 1440;
    }), true);
  t.bang('Cộng đủ 4 ngày bằng tổng thời gian dừng',
    ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']
      .reduce(function (s, n) { return s + phutDungTrongNgay_(kMotor, n); }, 0),
    900 + 1440 + 1440 + 900);

  // Phiếu chưa đóng: đồng hồ chạy tới "bây giờ", và phải đánh dấu còn đang dừng.
  const conDung = _phieu_({
    Trang_Thai_May: 'DA_DUNG', Thoi_Gian_Dung_May: _luc_('2026-08-14T08:00'),
  }).v;
  const kConDung = khoangDungMay_(conDung, _luc_('2026-08-14T11:30'));
  t.bang('Phiếu chưa đóng vẫn tính downtime',
    phutDungTrongNgay_(kConDung, '2026-08-14'), 210);
  t.bang('Phiếu chưa đóng được đánh dấu còn đang dừng', kConDung.dangDung, true);
  t.bang('Máy còn chạy thì không có khoảng dừng',
    khoangDungMay_(_phieu_({ Trang_Thai_May: 'DANG_CHAY',
      Thoi_Gian_Bao: _luc_('2026-08-14T08:00') }).v, _luc_('2026-08-14T11:30')), null);
  t.bang('Việc chung không có khoảng dừng',
    khoangDungMay_(_phieu_({ Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
      Trang_Thai_May: 'DA_DUNG',
      Thoi_Gian_Bao: _luc_('2026-08-14T08:00') }).v, _luc_('2026-08-14T11:30')), null);
  t.bang('Không có khoảng thì phút bằng 0', phutDungTrongNgay_(null, '2026-08-14'), 0);

  // Dải ngày và nhãn
  t.bang('Dải ngày lấy cả hai đầu',
    dsNgayTrongKy_('2026-08-10', '2026-08-13'),
    ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']);
  t.bang('Một ngày duy nhất', dsNgayTrongKy_('2026-08-10', '2026-08-10').length, 1);
  t.bang('Đến trước từ thì rỗng', dsNgayTrongKy_('2026-08-10', '2026-08-09'), []);
  t.bang('Dải ngày vắt qua tháng',
    dsNgayTrongKy_('2026-07-31', '2026-08-01'), ['2026-07-31', '2026-08-01']);
  t.bang('Thứ trong tuần',
    [thuCuaNgay_('2026-08-10'), thuCuaNgay_('2026-08-16')], ['T2', 'CN']);

  t.bang('Cuối tháng 8', khoangCuaThang_('08/2026'),
    { tu: '2026-08-01', den: '2026-08-31' });
  t.bang('Tháng 2 năm thường', khoangCuaThang_('02/2026').den, '2026-02-28');
  t.bang('Tháng 2 năm nhuận', khoangCuaThang_('02/2028').den, '2028-02-29');

  t.bang('Trọn tháng thì nhãn gọn lại',
    nhanKy_('2026-08-01', '2026-08-31'), 'Tháng 08/2026');
  t.bang('Khoảng lẻ hiện đủ hai đầu',
    nhanKy_('2026-08-10', '2026-08-14'), '10/08/2026 – 14/08/2026');
  t.bang('Tên file trọn tháng giữ nguyên như cũ',
    tenFileXuat_('2026-08-01', '2026-08-31', [], []), 'BaoCao_HuHong_T08_2026');
  t.bang('Tên file khoảng lẻ có lọc',
    tenFileXuat_('2026-08-10', '2026-08-14', ['MTX'], ['Nhân M']),
    'BaoCao_HuHong_2026-08-10_den_2026-08-14_MTX_NhânM');

  // Bảng thống kê chỉ liệt kê máy/thợ liên quan, không đổ cả danh mục ra.
  const mayGia = [
    { Ma_May: 'M1', Ten_May: 'Máy 1 kim 01', Bo_Phan: 'MTX' },
    { Ma_May: 'M2', Ten_May: 'Máy dệt 01', Bo_Phan: 'DET' },
  ];
  t.bang('Lọc máy theo bộ phận',
    locMayTheoBoPhan_(mayGia, { dsBoPhan: ['MTX'] }).map(function (m) { return m.Ma_May; }),
    ['M1']);
  t.bang('Không lọc thì giữ cả danh mục',
    locMayTheoBoPhan_(mayGia, { dsBoPhan: [] }).length, 2);

  const thoGia = [
    { Ten_Tho: 'Nhân M', Bo_Phan_Phu_Trach: 'MTX,CMTD' },
    { Ten_Tho: 'Hảo', Bo_Phan_Phu_Trach: 'DET' },
    { Ten_Tho: '', Bo_Phan_Phu_Trach: 'MTX' },
  ];
  t.bang('Thợ không tên bị loại khỏi bảng',
    locThoTheoCtx_(thoGia, {}).length, 2);
  t.bang('Lọc bộ phận → chỉ thợ phụ trách bộ phận đó',
    locThoTheoCtx_(thoGia, { dsBoPhan: ['MTX'] }).map(function (x) { return x.Ten_Tho; }),
    ['Nhân M']);
  t.bang('Chọn thợ thì ưu tiên đúng người đã chọn',
    locThoTheoCtx_(thoGia, { dsBoPhan: ['MTX'], dsTho: ['Hảo'] })
      .map(function (x) { return x.Ten_Tho; }),
    ['Hảo']);

  // Gom theo ngày — nguồn chung của trang Bao_Cao và sheet Theo_Ngay. Hai nơi
  // dùng chung hàm này nên không thể ra số lệch nhau.
  const gomDs = [
    _phieu_({ Ma_Su_Co: 'SC-A', Ngay_Ca: '2026-08-10', Ten_May: 'Máy 1 kim 01',
      Ten_Tho: 'Nhân M', Trang_Thai_May: 'DA_DUNG', Phut_Xu_Ly: 40,
      Phut_Tiep_Nhan: 12, Phut_Dap_Ung_Thuc: 12,
      Thoi_Gian_Dung_May: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T09:00') }).v,
    _phieu_({ Ma_Su_Co: 'SC-B', Ngay_Ca: '2026-08-11', Ten_May: 'Máy 1 kim 01',
      Ten_Tho: 'Nhân M', Trang_Thai_May: 'DA_DUNG', Phut_Xu_Ly: 20,
      Phut_Tiep_Nhan: 8, Phut_Dap_Ung_Thuc: 8,
      Thoi_Gian_Dung_May: _luc_('2026-08-11T08:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-11T08:30') }).v,
    _phieu_({ Ma_Su_Co: 'DM-A', Ngay_Ca: '2026-08-10', Ten_May: 'Máy 1 kim 02',
      Loai_Phieu: LOAI_PHIEU.DUNG_MAY, Trang_Thai_May: 'DA_DUNG',
      Thoi_Gian_Dung_May: _luc_('2026-08-10T23:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-11T01:00') }).v,
  ];
  const gomKq = gomTheoNgay_(gomDs, { tuNgay: '2026-08-10', denNgay: '2026-08-11' },
    _luc_('2026-08-20T00:00'));

  t.bang('Gom theo ngày ra đúng số dòng', gomKq.dong.length, 2);
  t.bang('Ngày 10/08 — 1 lần sửa, 1 phiếu dừng không do hư',
    [gomKq.dong[0].soSuCo, gomKq.dong[0].soDung], [1, 1]);
  // "Số lần máy phải dừng" đếm MỌI phiếu làm máy nằm im, không chỉ phiếu DM-.
  // Tách hai khái niệm vì dòng tổng từng ghi "0 lần dừng máy" ngay cạnh
  // "4,2 giờ máy nằm im" — đúng kỹ thuật nhưng đọc lên là mâu thuẫn.
  t.bang('Ngày 10/08 — 2 lần máy phải dừng (1 sự cố + 1 phiếu DM)',
    gomKq.dong[0].soPhaiDung, 2);
  const ngayConChay = gomTheoNgay_([
    _phieu_({ Ma_Su_Co: 'SC-C', Ngay_Ca: '2026-08-10', Trang_Thai_May: 'DANG_CHAY',
      Thoi_Gian_Bao: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T08:30') }).v,
  ], { tuNgay: '2026-08-10', denNgay: '2026-08-10' },
    _luc_('2026-08-20T00:00')).dong[0];

  t.bang('Sự cố không làm dừng máy thì không đếm là lần máy phải dừng',
    [ngayConChay.soSuCo, ngayConChay.soPhaiDung, ngayConChay.tongPhut], [1, 0, 0]);
  // Nhưng phiếu đó VẪN phải hiện trong nhật ký, với dòng "không dừng máy" —
  // máy vẫn hỏng và thợ vẫn mất công sửa, chỉ là dây chuyền không phải dừng.
  t.bang('Phiếu máy còn chạy vẫn nằm trong nhật ký ngày',
    [ngayConChay.phieu.length, ngayConChay.phieu[0].khoang], [1, null]);
  t.bang('Ngày 10/08 — 60 phút do hư, 60 phút nguyên nhân khác',
    [gomKq.dong[0].phutHu, gomKq.dong[0].phutKhac], [60, 60]);
  // Phiếu dừng máy vắt qua nửa đêm: 60 phút thuộc ngày 10, 60 phút thuộc ngày 11.
  t.bang('Phần sau nửa đêm rơi sang ngày hôm sau',
    [gomKq.dong[1].phutHu, gomKq.dong[1].phutKhac], [30, 60]);
  t.bang('Tổng phút của một ngày = hư + khác',
    gomKq.dong[0].tongPhut, 120);
  t.bang('Tổng cả kỳ cộng đúng',
    [gomKq.tong.soSuCo, gomKq.tong.soDung, gomKq.tong.tongPhut, gomKq.tong.phutSua],
    [2, 1, 210, 60]);
  t.bang('Quy ra giờ làm tròn 1 chữ số', [quyRaGio_(210), quyRaGio_(0)], [3.5, 0]);

  // Nhật ký từng ngày: phiếu vắt qua nửa đêm phải xuất hiện ở CẢ HAI ngày, kèm
  // chữ "còn tiếp" / "tiếp từ" — nếu không người đọc tưởng máy hỏng hai lần.
  t.bang('Ngày 10/08 có 2 phiếu, ngày 11/08 có 2 phiếu',
    [gomKq.dong[0].phieu.length, gomKq.dong[1].phieu.length], [2, 2]);
  t.bang('Phiếu DM- xuất hiện ở cả hai ngày',
    [gomKq.dong[0].phieu.some(function (p) { return p.v[COT.Ma_Su_Co] === 'DM-A'; }),
     gomKq.dong[1].phieu.some(function (p) { return p.v[COT.Ma_Su_Co] === 'DM-A'; })],
    [true, true]);
  t.bang('Sang ngày sau thì không còn tính là phiếu mở trong ngày',
    gomKq.dong[1].phieu.filter(function (p) {
      return p.v[COT.Ma_Su_Co] === 'DM-A';
    })[0].moTrongNgay, false);

  const kDM = gomKq.dong[0].phieu.filter(function (p) {
    return p.v[COT.Ma_Su_Co] === 'DM-A';
  })[0].khoang;
  t.bang('Ngày mở phiếu ghi "còn tiếp"',
    moTaGioDung_(kDM, '2026-08-10'), '23:00 → còn tiếp');
  t.bang('Ngày sau ghi "tiếp từ"',
    moTaGioDung_(kDM, '2026-08-11'), '→ 01:00 (tiếp từ 10/08)');
  t.bang('Phiếu gọn trong ngày ghi đủ hai đầu giờ',
    moTaGioDung_(khoangDungMay_(gomDs[0], _luc_('2026-08-20T00:00')), '2026-08-10'),
    '08:00–09:00');
  t.bang('Phiếu vắt trọn một ngày',
    moTaGioDung_({ tu: _luc_('2026-08-10T09:00'), den: _luc_('2026-08-13T15:00'),
      dangDung: false }, '2026-08-11'), 'cả ngày (tiếp từ 10/08)');
  t.bang('Máy chưa chạy lại được nói rõ',
    moTaGioDung_({ tu: _luc_('2026-08-10T08:00'), den: _luc_('2026-08-10T11:00'),
      dangDung: true }, '2026-08-10'), '08:00–11:00 (chưa chạy lại)');
  t.bang('Không có khoảng dừng', moTaGioDung_(null, '2026-08-10'), 'không dừng máy');
  t.bang('Tiêu đề ngày có thứ',
    tieuDeNgay_('2026-08-10'), 'THỨ HAI, 10/08/2026');
  t.bang('Đáp ứng trung bình của ngày',
    [trungBinh_(gomKq.dong[0].dapUng), trungBinh_(gomKq.dong[1].dapUng)], [12, 8]);

  // Chỉ đích danh phiếu gây ra chờ. Đây là thứ làm con số "chờ do thợ bận" kiểm
  // chứng được — trước đó hệ thống tự trừ thời gian mà không nói vì phiếu nào.
  const banDs = [
    _phieu_({ Ma_Su_Co: 'SC-CU', Ma_Tho: 'TH02', Ten_Tho: 'Nhân M',
      Ngay_Ca: '2026-08-10',
      Thoi_Gian_Bao: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Nhan: _luc_('2026-08-10T08:05'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T09:15') }).v,
    _phieu_({ Ma_Su_Co: 'SC-MOI', Ma_Tho: 'TH02', Ten_Tho: 'Nhân M',
      Ngay_Ca: '2026-08-10',
      Thoi_Gian_Bao: _luc_('2026-08-10T09:00'),
      Thoi_Gian_Nhan: _luc_('2026-08-10T09:24'),
      Phut_Tiep_Nhan: 24, Phut_Cho_Tho_Ban: 15, Phut_Dap_Ung_Thuc: 9,
      So_Chong_Viec: 0 }).v,
    _phieu_({ Ma_Su_Co: 'SC-KHAC', Ma_Tho: 'TH09', Ten_Tho: 'Hảo',
      Ngay_Ca: '2026-08-10',
      Thoi_Gian_Bao: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Nhan: _luc_('2026-08-10T08:10'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T09:20') }).v,
  ];
  t.bang('Tìm đúng phiếu khiến máy phải chờ',
    timPhieuGayBan_(banDs[1], banDs).ma, 'SC-CU');
  t.bang('Không lấy nhầm phiếu của thợ khác',
    timPhieuGayBan_(banDs[1], [banDs[1], banDs[2]]), null);
  t.bang('Phiếu không phải chờ thì không có nguồn gây bận',
    timPhieuGayBan_(banDs[0], banDs), null);

  // Chồng việc = 0 nhưng vẫn bị trừ 15 phút — đúng ca người dùng thắc mắc.
  const pBan = { v: banDs[1], khoang: null, phut: 0, moTrongNgay: true };
  t.bang('Ghi chú nói rõ chờ vì phiếu nào',
    ghiChuDong_(pBan, '2026-08-10', { ma: 'SC-CU' }),
    'máy vẫn chạy · chờ 15 phút do thợ đang làm SC-CU');
  t.bang('Việc gây bận nằm ngoài phạm vi lọc thì nói rõ',
    ghiChuDong_(pBan, '2026-08-10', null),
    'máy vẫn chạy · chờ 15 phút do thợ bận việc ngoài phạm vi báo cáo này');
  t.bang('Phiếu tiếp từ hôm trước không ghi lại lý do chờ',
    ghiChuDong_({ v: banDs[1], khoang: null, phut: 0, moTrongNgay: false },
      '2026-08-11', { ma: 'SC-CU' }),
    'tiếp từ 10/08 · máy vẫn chạy');

  // Mốc giờ khác ngày phải kèm ngày, nếu không đọc nhầm là báo hư hôm nay.
  t.bang('Mốc trong ngày chỉ hiện giờ',
    mocTrongNgay_(_luc_('2026-08-10T14:00'), '2026-08-10'), '14:00');
  t.bang('Mốc khác ngày kèm ngày',
    mocTrongNgay_(_luc_('2026-08-10T14:00'), '2026-08-11'), '10/08 14:00');
  t.bang('Không có mốc thì gạch ngang', mocTrongNgay_('', '2026-08-10'), '—');

  const gomBan = gomTheoNgay_(banDs, { tuNgay: '2026-08-10', denNgay: '2026-08-10' },
    _luc_('2026-08-20T00:00'));
  t.bang('Đếm số phiếu phải chờ vì thợ bận trong ngày',
    gomBan.dong[0].soChoBan, 1);
  t.bang('Chờ + sau khi rảnh = đáp ứng',
    Number(banDs[1][COT.Phut_Cho_Tho_Ban]) + Number(banDs[1][COT.Phut_Dap_Ung_Thuc]),
    Number(banDs[1][COT.Phut_Tiep_Nhan]));

  const thoBan = gomTheoMayTho_(banDs).theoTho['Nhân M'];
  t.bang('Thợ — 1 phiếu phải chờ, tổng 15 phút, 0 lần chồng việc',
    [thoBan.soChoBan, thoBan.tongCho, thoBan.chong], [1, 15, 0]);

  const gomMT = gomTheoMayTho_(gomDs);
  t.bang('Gom theo máy chỉ đếm sự cố, bỏ phiếu dừng máy',
    Object.keys(gomMT.theoMay), ['Máy 1 kim 01']);
  t.bang('Máy hỏng 2 lần, tổng downtime 90 phút',
    [gomMT.theoMay['Máy 1 kim 01'].lan, gomMT.theoMay['Máy 1 kim 01'].downtime],
    [2, 90]);
  t.bang('Đếm theo loại phiếu',
    [gomMT.tong.soSuCo, gomMT.tong.soDungMay], [2, 1]);
  t.bang('Thợ — tổng phút sửa và tổng phút máy dừng',
    [gomMT.theoTho['Nhân M'].tongSua, gomMT.theoTho['Nhân M'].tongDung], [60, 90]);
  t.bang('Phiếu dừng máy không tạo dòng thợ nào',
    Object.keys(gomMT.theoTho), ['Nhân M']);

  t.bang('Nhật ký Dệt chỉ lấy sự cố, bỏ dừng máy',
    _ma_(locSuCoDet_([
      _phieu_({ Ma_Su_Co: 'SC-D', Bo_Phan: 'DET' }).v,
      _phieu_({ Ma_Su_Co: 'DM-D', Bo_Phan: 'DET', Loai_Phieu: LOAI_PHIEU.DUNG_MAY }).v,
      _phieu_({ Ma_Su_Co: 'SC-X', Bo_Phan: 'MTX' }).v,
    ])),
    ['SC-D']);

  // --- 18. Báo cáo trong ngày: gom sự cố theo bộ phận ------------------------
  // Thứ tự bộ phận theo LÚC XUẤT HIỆN, không theo bảng chữ cái và không ưu tiên
  // bộ phận nào. Trong mỗi bộ phận vẫn theo giờ.
  const dsGom = [
    { ma: 'SC-3', boPhan: 'MTX', tsBao: _luc_('2026-08-10T09:00').getTime() },
    { ma: 'SC-1', boPhan: 'DET', tsBao: _luc_('2026-08-10T07:30').getTime() },
    { ma: 'SC-4', boPhan: 'MTX', tsBao: _luc_('2026-08-10T08:15').getTime() },
    { ma: 'SC-2', boPhan: 'DET', tsBao: _luc_('2026-08-10T10:00').getTime() },
    { ma: 'SC-5', boPhan: 'SOI', tsBao: _luc_('2026-08-10T07:45').getTime() },
  ];
  t.bang('Gom theo bộ phận, bộ phận xuất hiện sớm nhất đứng trước',
    sapTheoBoPhanRoiGio_(dsGom).map(function (x) { return x.ma; }),
    ['SC-1', 'SC-2', 'SC-5', 'SC-4', 'SC-3']);
  t.bang('Bộ phận trống vẫn có chỗ đứng',
    nhomBoPhan_({ boPhan: '  ' }), '(không rõ bộ phận)');

  // Ca đêm vắt qua nửa đêm: phiếu 01:00 sáng thuộc Ngay_Ca hôm trước nên phải
  // nằm SAU phiếu 22:00 cùng ca. So chuỗi 'HH:mm' sẽ đẩy nó lên đầu ngày.
  t.bang('Ca đêm không bị nhảy lên đầu',
    sapTheoBoPhanRoiGio_([
      { ma: 'DEM', boPhan: 'DET', tsBao: _luc_('2026-08-11T01:00').getTime() },
      { ma: 'TOI', boPhan: 'DET', tsBao: _luc_('2026-08-10T22:00').getTime() },
    ]).map(function (x) { return x.ma; }),
    ['TOI', 'DEM']);

  // --- 18. Bù phiếu dừng máy -------------------------------------------------
  t.bang('Đọc mốc yyyy-MM-dd HH:mm',
    mocTuChuoi_('2026-08-18 17:27').getTime(), _luc_('2026-08-18T17:27').getTime());
  t.bang('Chấp nhận cả dấu T ngăn cách',
    mocTuChuoi_('2026-08-18T17:27').getTime(), _luc_('2026-08-18T17:27').getTime());
  t.bang('Sai định dạng thì trả null',
    [mocTuChuoi_('18/08/2026 17:27'), mocTuChuoi_('2026-08-18'),
     mocTuChuoi_('2026-8-18 7:5'), mocTuChuoi_('')],
    [null, null, null, null]);

  // Ca thật của tời nâng số 1: phiếu sự cố đóng 18/08 17:27, tới 20/08 08:52 mới
  // ráp xong — 39 giờ 25 phút máy đứng không phiếu nào phủ.
  t.bang('Khoảng bù của tời nâng ra đúng số phút',
    Math.round((mocTuChuoi_('2026-08-20 08:52').getTime() -
                mocTuChuoi_('2026-08-18 17:27').getTime()) / 60000), 2365);

  // --- 19. Tỉ lệ hiệu dụng A -------------------------------------------------
  t.bang('Chuẩn hoá khoá bỏ dấu và đ',
    [chuanKhoa_('CMTĐ'), chuanKhoa_('Chung'), chuanKhoa_(' Máy  kéo sợi ')],
    ['CMTD', 'CHUNG', 'MAY KEO SOI']);
  t.bang('Ô tick đọc được cả chữ lẫn boolean',
    [batCauHinh_(true), batCauHinh_('TRUE'), batCauHinh_('false'),
     batCauHinh_('', true), batCauHinh_('', false)],
    [true, true, false, true, false]);
  t.bang('Ngày nghỉ nhận cả hai định dạng',
    docNgayNghi_('02/09/2026, 2026-09-03'),
    { '2026-09-02': true, '2026-09-03': true });

  // Kế hoạch giả: bộ phận TEST chạy 07:00–17:00 (600 phút), T2–T7, chủ nhật nghỉ.
  const khGia = {
    TEST: {
      ten: 'TEST', tu: 420, den: 1020, caDem: false,
      thu: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 0: false },
      nghi: {},
    },
  };
  const mayHD = [{ Ma_May: 'M1', Ten_May: 'Máy thử 1', Bo_Phan: 'TEST', Hoat_Dong: true }];
  const ctGia = { suCo: true, dungMay: true, congViec: false };

  t.bang('Ngày thường ra đúng một khung 600 phút',
    tongPhutKhoang_(khungKeHoachNgay_(khGia.TEST, '2026-08-10')), 600);
  t.bang('Chủ nhật không có khung nào',
    khungKeHoachNgay_(khGia.TEST, '2026-08-16').length, 0);
  t.bang('Bộ phận có ca đêm chạy trọn 24 giờ',
    tongPhutKhoang_(khungKeHoachNgay_(
      { tu: 420, den: 1020, caDem: true, thu: { 1: true }, nghi: {} }, '2026-08-10')), 1440);
  t.bang('Ngày nghỉ lễ bị loại khỏi kế hoạch',
    khungKeHoachNgay_(
      { tu: 420, den: 1020, caDem: false, thu: { 1: true }, nghi: { '2026-08-10': true } },
      '2026-08-10').length, 0);

  const khCoNghi = {
    tu: 420, den: 1020, caDem: false, thu: { 1: true }, nghi: {},
    tamDung: [{ loai: 'NGHI_TRUA', tu: 690, den: 750, thu: null }],
  };
  t.bang('Nghỉ trưa bị loại khỏi kế hoạch',
    tongPhutKhoang_(khungKeHoachNgay_(khCoNghi, '2026-08-10')), 540);
  t.bang('Nghỉ trưa tách ca thành hai khung chạy',
    khungKeHoachNgay_(khCoNghi, '2026-08-10').map(function (x) {
      return [fmtGio_(x.tu), fmtGio_(x.den)];
    }), [['07:00', '11:30'], ['12:30', '17:00']]);

  const khCoGiaoCa = {
    tu: 420, den: 1020, caDem: true, thu: { 1: true }, nghi: {},
    tamDung: [
      { loai: 'GIAO_CA', tu: 1020, den: 1035, thu: null },
      { loai: 'GIAO_CA', tu: 410, den: 420, thu: null },
    ],
  };
  t.bang('Ca 24 giờ trừ cả giao ca ngày-đêm và đêm-ngày',
    tongPhutKhoang_(khungKeHoachNgay_(khCoGiaoCa, '2026-08-10')), 1415);

  // Đại số khoảng — nền của mọi con số phía trên.
  t.bang('Hai khoảng rời nhau thì không giao',
    giaoKhoang_({ tu: _luc_('2026-08-10T08:00'), den: _luc_('2026-08-10T09:00') },
                { tu: _luc_('2026-08-10T10:00'), den: _luc_('2026-08-10T11:00') }), null);
  t.bang('Khoảng chồng nhau gộp làm một, không cộng hai lần',
    tongPhutKhoang_(gomKhoang_([
      { tu: _luc_('2026-08-10T08:00'), den: _luc_('2026-08-10T10:00') },
      { tu: _luc_('2026-08-10T09:00'), den: _luc_('2026-08-10T11:00') },
    ])), 180);
  t.bang('Trừ một khoảng giữa tách thành hai phần',
    truKhoang_([
      { tu: _luc_('2026-08-10T07:00'), den: _luc_('2026-08-10T17:00') },
    ], [
      { tu: _luc_('2026-08-10T11:30'), den: _luc_('2026-08-10T12:30') },
    ]).map(function (x) { return [fmtGio_(x.tu), fmtGio_(x.den)]; }),
    [['07:00', '11:30'], ['12:30', '17:00']]);

  // Sự cố mà máy VẪN CHẠY không được trừ vào A.
  t.bang('Sự cố máy còn chạy không sinh khoảng dừng',
    khoangDungCuaPhieu_(_phieu_({
      Trang_Thai_May: 'DANG_CHAY',
      Thoi_Gian_Bao: _luc_('2026-08-10T08:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T09:00'),
    }).v, _luc_('2026-08-10T12:00')), null);

  function _hd_(dsPhieu, bayGio) {
    return tinhHieuDung_('2026-08-10', '2026-08-16', {
      bayGio: bayGio || _luc_('2026-08-17T00:00'),
      keHoach: khGia, congTac: ctGia, dsMay: mayHD, dsPhieu: dsPhieu,
    });
  }

  // 10–15/08 là T2–T7, 16/08 chủ nhật nghỉ → 6 ngày × 600 phút.
  t.bang('Kế hoạch tuần bỏ chủ nhật', _hd_([]).tong.phutKeHoach, 3600);
  t.bang('Không phiếu nào thì A = 100%', _hd_([]).tong.tiLe, 1);

  const khNghiGia = {
    TEST: {
      ten: 'TEST', tu: 420, den: 1020, caDem: false,
      thu: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 0: false },
      nghi: {}, tamDung: [{ loai: 'NGHI_TRUA', tu: 690, den: 750, thu: null }],
    },
  };
  function _hdNghi_(tu, den) {
    return tinhHieuDung_('2026-08-10', '2026-08-10', {
      bayGio: _luc_('2026-08-11T00:00'), keHoach: khNghiGia,
      congTac: ctGia, dsMay: mayHD,
      dsPhieu: [_phieu_({
        Ma_Su_Co: 'SC-N', Ma_May: 'M1', Trang_Thai_May: 'DA_DUNG',
        Thoi_Gian_Dung_May: _luc_(tu), Thoi_Gian_Hoan_Thanh: _luc_(den),
      }).v],
    });
  }
  t.bang('Dừng hoàn toàn trong giờ nghỉ trưa không làm giảm A',
    _hdNghi_('2026-08-10T11:30', '2026-08-10T12:30').may[0].phutDung, 0);
  t.bang('Dừng xuyên nghỉ trưa chỉ trừ phần thuộc giờ chạy',
    _hdNghi_('2026-08-10T11:00', '2026-08-10T13:00').may[0].phutDung, 60);

  // Ca thật của tời nâng: máy đứng từ 17:27 hôm trước tới 08:52 hai hôm sau —
  // 39 giờ 25 đồng hồ, nhưng chỉ 712 phút rơi vào giờ kế hoạch (cả ngày 11/08
  // là 600, sáng 12/08 từ 07:00 tới 08:52 là 112; 17:27 ngày 10/08 đã ngoài ca).
  const toiNang = _phieu_({
    Ma_Su_Co: 'DM-1', Ma_May: 'M1', Loai_Phieu: LOAI_PHIEU.DUNG_MAY,
    Thoi_Gian_Dung_May: _luc_('2026-08-10T17:27'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-12T08:52'),
  }).v;
  t.bang('Dừng 39 giờ chỉ ăn đúng phần giờ kế hoạch',
    _hd_([toiNang]).may[0].phutDung, 712);
  t.bang('A không bao giờ âm dù dừng vắt nhiều ngày',
    Math.round(_hd_([toiNang]).tong.tiLe * 10000) / 10000,
    Math.round((3600 - 712) / 3600 * 10000) / 10000);

  // Phiếu sự cố và phiếu dừng máy chồng nhau của cùng một máy — đúng quy trình
  // đem đồ ra ngoài gia công. Cộng riêng từng phiếu là đếm downtime hai lần.
  const scChong = _phieu_({
    Ma_Su_Co: 'SC-1', Ma_May: 'M1', Trang_Thai_May: 'DA_DUNG',
    Thoi_Gian_Dung_May: _luc_('2026-08-10T08:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T10:00'),
  }).v;
  const dmChong = _phieu_({
    Ma_Su_Co: 'DM-2', Ma_May: 'M1', Loai_Phieu: LOAI_PHIEU.DUNG_MAY,
    Thoi_Gian_Dung_May: _luc_('2026-08-10T09:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T11:00'),
  }).v;
  t.bang('Phiếu chồng nhau chỉ tính một lần',
    _hd_([scChong, dmChong]).may[0].phutDung, 180);

  // Máy đứng nguyên chủ nhật vẫn không mất giờ nào: hôm đó không có kế hoạch.
  t.bang('Dừng đúng ngày nghỉ không trừ vào A',
    _hd_([_phieu_({
      Ma_Su_Co: 'DM-3', Ma_May: 'M1', Loai_Phieu: LOAI_PHIEU.DUNG_MAY,
      Thoi_Gian_Dung_May: _luc_('2026-08-16T00:00'),
      Thoi_Gian_Hoan_Thanh: _luc_('2026-08-16T23:59'),
    }).v]).may[0].phutDung, 0);

  // Giữa kỳ thì kế hoạch chỉ tính tới lúc chạy báo cáo — lấy cả tuần thì sáng
  // thứ Ba máy nào cũng trông như vừa đứng bốn ngày.
  t.bang('Kế hoạch cắt tại thời điểm chạy báo cáo',
    _hd_([], _luc_('2026-08-11T12:00')).tong.phutKeHoach, 900);

  // Việc chung đang TẮT trong ctGia nên không được trừ, dù phiếu ghi đúng máy.
  const cvPhieu = _phieu_({
    Ma_Su_Co: 'CV-1', Ten_May: 'Máy thử 1', Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
    Thoi_Gian_Nhan: _luc_('2026-08-10T08:00'),
    Thoi_Gian_Hoan_Thanh: _luc_('2026-08-10T10:00'),
  }).v;
  t.bang('Việc chung tắt thì không trừ', _hd_([cvPhieu]).may[0].phutDung, 0);
  t.bang('Việc chung bật thì dò ngược theo tên máy',
    tinhHieuDung_('2026-08-10', '2026-08-16', {
      bayGio: _luc_('2026-08-17T00:00'), keHoach: khGia, dsMay: mayHD,
      congTac: { suCo: true, dungMay: true, congViec: true }, dsPhieu: [cvPhieu],
    }).may[0].phutDung, 120);

  // Bộ phận chưa khai kế hoạch: A phải là null, KHÔNG phải 0 — chưa đo được và
  // đứng cả tuần là hai chuyện khác hẳn nhau.
  const kqThieu = tinhHieuDung_('2026-08-10', '2026-08-16', {
    bayGio: _luc_('2026-08-17T00:00'), keHoach: {}, congTac: ctGia,
    dsMay: mayHD, dsPhieu: [],
  });
  t.bang('Chưa khai kế hoạch thì A là null, không phải 0', kqThieu.may[0].tiLe, null);
  t.bang('Và bộ phận đó được nêu tên để đi khai', kqThieu.thieuKeHoach, ['TEST']);

  // --- 20. Thông báo Telegram ------------------------------------------------
  //
  // ⚠️ Phần lớn các ca dưới đây là bản SAO của `kiemtra/thongbao.js`. Sửa kỳ vọng
  // ở một bên mà quên bên kia thì bộ chạy tại máy vẫn xanh trong khi bộ này đỏ —
  // đã dính đúng một lần ngày 03/09/2026 với `kpi-tho.js`. Sửa ca nào thì sửa CẢ
  // HAI chỗ rồi chạy lại cả hai.
  //
  // Phần CHỈ có ở đây, không chép được sang bộ tại máy, là nhóm ca cuối: thay hàm
  // gửi và hàm đọc sheet bằng hàm giả để chạy thử hai hàm ghép. Bộ tại máy không
  // làm được vì `lienLacTho_` đọc `Danh_Muc_Tho`.

  const _phieuTg_ = function (o) {
    const v = new Array(HEADER_SU_CO.length).fill('');
    Object.keys(o).forEach(function (k) { v[COT[k]] = o[k]; });
    return v;
  };
  const _mauTg_ = {
    Ma_Su_Co: 'SC-0909-014', Ma_May: 'DET12', Ten_May: 'MÁY DỆT 12', Bo_Phan: 'DET',
    Nhom_Loi: 'Lỗi cơ khí', Mo_Ta: 'Máy kêu to rồi dừng đột ngột',
    Thoi_Gian_Bao: _luc_('2026-09-09T14:32'),
    Ten_Tho: 'Nhân', Thoi_Gian_Nhan: _luc_('2026-09-09T14:35'),
  };
  const _LINK_ = 'https://x.io/baotri.html?tho=TH01&token=abc';

  // Việt Nam không có giờ mùa hè nên +07:00 là hằng số, không phải xấp xỉ.
  t.bang('gioVN_ đổi đúng mốc UTC sang giờ Việt Nam',
    gioVN_(new Date('2026-09-09T07:32:00Z')), '14:32');
  t.bang('gioVN_ vắt qua nửa đêm', gioVN_(new Date('2026-09-09T18:30:00Z')), '01:30');
  t.bang('gioVN_ với ô trống trả rỗng', gioVN_(''), '');
  // In ra số phút âm là người đọc mất tin tưởng vào cả cái bot.
  t.bang('phutGiua_ giờ ngược nhau trả 0',
    phutGiua_(_luc_('2026-09-09T15:00'), _luc_('2026-09-09T14:00')), 0);

  t.bang('Tin sự cố đầy đủ khớp nguyên văn mẫu mục 4.3',
    soanTinSuCoMoi_(_phieuTg_(_mauTg_), _LINK_),
    '🔴 MÁY DỆT 12 (DET) đã dừng\n' +
    'Lỗi cơ khí\n' +
    '"Máy kêu to rồi dừng đột ngột"\n' +
    'Báo lúc 14:32 · phiếu SC-0909-014\n' +
    '\n' +
    '➡️ Bấm để nhận việc: ' + _LINK_);
  // Phiếu DM- không có nhóm lỗi. In ra dòng trắng là tin trông như lỗi hiển thị.
  t.bang('Thiếu nhóm lỗi thì rụng đúng dòng đó',
    soanTinSuCoMoi_(_phieuTg_({ Ten_May: 'MÁY SOI 4', Bo_Phan: 'SOI',
      Ma_Su_Co: 'DM-0909-003', Thoi_Gian_Bao: _luc_('2026-09-09T08:00') }), ''),
    '🔴 MÁY SOI 4 (SOI) đã dừng\nBáo lúc 08:00 · phiếu DM-0909-003');
  // Tin là văn bản trơn, cố ý không dùng parse_mode.
  t.bang('Ký tự đặc biệt trong mô tả giữ nguyên văn',
    soanTinSuCoMoi_(_phieuTg_({ Ten_May: 'M', Mo_Ta: 'Kêu <to> *gấp* _cần_ sửa' }), '')
      .indexOf('"Kêu <to> *gấp* _cần_ sửa"') > 0, true);

  t.bang('Tin đã nhận khớp nguyên văn mẫu mục 4.3',
    soanTinDaNhan_(_phieuTg_(_mauTg_)),
    '✅ Nhân đã nhận SC-0909-014 lúc 14:35. Bạn không cần xử lý.');

  const _nhac1_ = soanTinNhac_(_phieuTg_(_mauTg_), 1, _luc_('2026-09-09T14:52'),
    _LINK_, '0912345678');
  const _nhac2_ = soanTinNhac_(_phieuTg_(_mauTg_), 2, _luc_('2026-09-09T15:12'),
    _LINK_, '0912345678');
  t.bang('Nhắc lần 1 nêu số phút máy nằm im',
    _nhac1_.indexOf('Máy đã nằm im 20 phút.') > 0, true);
  // Lớp 3 ở mục 4.4: số khẩn cấp chỉ xuất hiện ở lần nhắc thứ hai. Đưa ra sớm là
  // mất hết sức nặng của nó.
  t.bang('Nhắc lần 1 KHÔNG kèm số khẩn cấp', _nhac1_.indexOf('0912345678') < 0, true);
  t.bang('Nhắc lần 2 kèm số khẩn cấp', _nhac2_.indexOf('0912345678') > 0, true);

  // Sheets đọc ô số lớn ra dạng mũ nếu người dùng dán đè định dạng. Gửi tới một
  // id đã bị làm tròn là nhắn nhầm người khác, nên thà không gửi.
  t.bang('chuanHoaChatId_ chặn dạng mũ của Sheets', chuanHoaChatId_('1.23457E+11'), '');
  t.bang('chuanHoaChatId_ nhận id âm của nhóm',
    chuanHoaChatId_('-1001234567890'), '-1001234567890');
  t.bang('catTin_ cắt tin quá dài và đánh dấu bị cắt', catTin_('abcdefgh', 5), 'abcd…');
  // 429 và 5xx hỏng phía hệ thống; 400 và 403 hỏng ở một chat id cụ thể.
  t.bang('nenBatCauChi_ bật khi bị chặn tốc độ', nenBatCauChi_([200, 429]), true);
  t.bang('nenBatCauChi_ KHÔNG bật vì một chat id sai', nenBatCauChi_([200, 400]), false);

  const _llTg_ = {
    TH01: { chatId: '111', link: 'https://x/?tho=TH01' },
    TH02: { chatId: '222', link: 'https://x/?tho=TH02' },
  };
  t.bang('Bỏ số khẩn cấp ở cuối danh bạ',
    locNguoiNhan_({ ds: [{ maTho: 'TH01' }, { maTho: '', khanCap: true }] }, _llTg_, '')
      .length, 1);
  t.bang('Bỏ chính người vừa bấm nhận',
    locNguoiNhan_({ ds: [{ maTho: 'TH01' }, { maTho: 'TH02' }] }, _llTg_, 'TH01')
      .map(function (n) { return n.maTho; }), ['TH02']);

  const _bay_ = _luc_('2026-09-09T15:00');
  const _phieuCho_ = function (ma, phutTruoc, trangThai) {
    return { dong: 1, v: _phieuTg_({ Ma_Su_Co: ma, Ma_May: 'DET12', Bo_Phan: 'DET',
      Trang_Thai: trangThai || TRANG_THAI.CHO_NHAN,
      Thoi_Gian_Bao: new Date(_bay_.getTime() - phutTruoc * 60000) }) };
  };
  const _chNhac_ = { NHAC_LAN_1_PHUT: '10', NHAC_LAN_2_PHUT: '20' };

  t.bang('Lần 2 đè lên lần 1 trong nhật ký',
    demLanDaNhac_([{ Ma_Su_Co: 'SC-1', Actor: 'BOT', Hanh_Dong: 'NHAC_LAN_1' },
      { Ma_Su_Co: 'SC-1', Actor: 'BOT', Hanh_Dong: 'NHAC_LAN_2' }]), { 'SC-1': 2 });
  t.bang('Chỉ đếm dòng của BOT, bỏ dòng của người',
    demLanDaNhac_([{ Ma_Su_Co: 'SC-1', Actor: 'TH01', Hanh_Dong: 'NHAN_VIEC' }]), {});
  t.bang('Quá ngưỡng 1 thì nhắc lần 1',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 12)], {}, _chNhac_, _bay_)
      .map(function (m) { return m.lan; }), [1]);
  // Rào 5.11: hai lần là hết, đời đời.
  t.bang('Đã nhắc lần 2 thì thôi hẳn',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 300)], { 'SC-1': 2 }, _chNhac_, _bay_), []);
  // Trigger chạy trễ: nhắc "lần 1" cho phiếu đã treo 3 tiếng là nói sai sự thật.
  t.bang('Quá cả hai ngưỡng ngay lần xét đầu thì nhảy thẳng lên lần 2',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 90)], {}, _chNhac_, _bay_)
      .map(function (m) { return m.lan; }), [2]);
  t.bang('Phiếu đã có thợ nhận thì không nhắc',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 60, TRANG_THAI.DANG_XU_LY)], {}, _chNhac_, _bay_), []);
  // Rào chặn lúc gõ BAT lần đầu: không có nó thì công tắc vừa bật là bot bắn một
  // loạt tin về những phiếu cũ còn treo từ trước.
  t.bang('Phiếu treo quá một ngày thì thôi',
    chonPhieuCanNhac_([_phieuCho_('SC-1', 1500)], {}, _chNhac_, _bay_), []);

  // --- 20b. Hai hàm ghép, chạy với hàm gửi GIẢ -------------------------------
  //
  // Nhóm ca duy nhất không chép sang `kiemtra/thongbao.js` được, vì `lienLacTho_`
  // đọc `Danh_Muc_Tho` và `thongBaoDaNhan_` gọi `getOnDutyContacts_`.
  //
  // Thay hàm bằng cách gán đè rồi TRẢ LẠI trong `finally`. Quên trả lại là mọi
  // test chạy sau đó dùng nhầm hàm giả — nguy hiểm hơn hẳn một test đỏ, vì nó
  // xanh mà sai.

  const _gocGui_ = guiTelegram_;
  const _gocLienLac_ = lienLacTho_;
  const _gocDanhBa_ = getOnDutyContacts_;
  let _daGui_ = [];

  try {
    guiTelegram_ = function (ds) { _daGui_ = ds || []; return _daGui_.length; };
    lienLacTho_ = function () { return _llTg_; };

    // Mỗi thợ phải nhận LINK CỦA CHÍNH MÌNH. Gửi nhầm link của người khác là thợ
    // A bấm nhận rồi hệ thống ghi tên thợ B.
    _daGui_ = [];
    const _so1_ = thongBaoSuCoMoi_(_phieuTg_(_mauTg_),
      { ds: [{ maTho: 'TH01' }, { maTho: 'TH02' }] }, { TELEGRAM_BAT: 'BAT' });
    t.bang('Gửi đúng 2 tin cho 2 thợ', _so1_, 2);
    t.bang('Đúng chat id của từng người',
      _daGui_.map(function (x) { return x.chatId; }), ['111', '222']);
    t.bang('Mỗi thợ nhận link riêng của mình',
      _daGui_.map(function (x) { return x.text.indexOf('?tho=TH0') > 0; }), [true, true]);
    t.bang('Thợ TH02 nhận đúng link TH02',
      _daGui_[1].text.indexOf('https://x/?tho=TH02') > 0, true);

    // Rào 5.4: ghép chat id cho 15 thợ làm dần, ai chưa có thì im lặng bỏ qua.
    _daGui_ = [];
    t.bang('Thợ chưa ghép chat id thì bỏ qua, không lỗi',
      thongBaoSuCoMoi_(_phieuTg_(_mauTg_), { ds: [{ maTho: 'TH09' }] }, {}), 0);
    t.bang('Và không gửi tin nào cả', _daGui_.length, 0);

    // Rào 5.1: hàm gửi hỏng KHÔNG được kéo theo thứ gì khác.
    guiTelegram_ = function () { throw new Error('Telegram chết hẳn'); };
    t.bang('Hàm gửi ném lỗi thì hàm ghép vẫn trả 0, không ném ra ngoài',
      thongBaoSuCoMoi_(_phieuTg_(_mauTg_), { ds: [{ maTho: 'TH01' }] }, {}), 0);
    t.bang('Hàm đọc sheet ném lỗi cũng vậy', (function () {
      lienLacTho_ = function () { throw new Error('Sheet hỏng'); };
      return thongBaoSuCoMoi_(_phieuTg_(_mauTg_), { ds: [{ maTho: 'TH01' }] }, {});
    })(), 0);

    // Báo đã có người nhận: gửi cho những người CÒN LẠI.
    lienLacTho_ = function () { return _llTg_; };
    guiTelegram_ = function (ds) { _daGui_ = ds || []; return _daGui_.length; };
    getOnDutyContacts_ = function () { return { ds: [{ maTho: 'TH01' }, { maTho: 'TH02' }] }; };

    _daGui_ = [];
    t.bang('Báo đã nhận chỉ gửi cho người còn lại',
      thongBaoDaNhan_(_phieuTg_(_mauTg_), 'TH01', {}), 1);
    t.bang('Đúng người còn lại', _daGui_[0].chatId, '222');
    t.bang('Và đúng nội dung tin đã nhận',
      _daGui_[0].text, '✅ Nhân đã nhận SC-0909-014 lúc 14:35. Bạn không cần xử lý.');

    // Ca trực chỉ có một người: nhận xong thì không còn ai để báo.
    getOnDutyContacts_ = function () { return { ds: [{ maTho: 'TH01' }] }; };
    _daGui_ = [];
    t.bang('Ca chỉ có một thợ thì không gửi tin nào',
      thongBaoDaNhan_(_phieuTg_(_mauTg_), 'TH01', {}), 0);
    t.bang('Thật sự không gửi gì', _daGui_.length, 0);

  } finally {
    guiTelegram_ = _gocGui_;
    lienLacTho_ = _gocLienLac_;
    getOnDutyContacts_ = _gocDanhBa_;
  }

  t.bang('Đã trả lại hàm gửi thật sau khi thay', guiTelegram_ === _gocGui_, true);
  t.bang('Đã trả lại hàm đọc danh mục thợ', lienLacTho_ === _gocLienLac_, true);
  t.bang('Đã trả lại hàm dựng danh bạ', getOnDutyContacts_ === _gocDanhBa_, true);

  // --- 15. Lưu trữ phiếu theo tháng lịch -------------------------------------
  // Mốc cắt và phép tách nhóm của archiveOldTickets. Cả hai đều là hàm thuần nên
  // kiểm được bằng dữ liệu giả, không đụng sheet nào.

  t.bang('Giữ 1 tháng, đứng ở 11/09 → cắt trước 2026-09',
    mocThangLuuTru_(_luc_('2026-09-11T02:00'), 1), '2026-09');
  t.bang('Giữ 2 tháng → cắt trước 2026-08',
    mocThangLuuTru_(_luc_('2026-09-11T02:00'), 2), '2026-08');
  // Qua năm: 01/2026 lùi 1 tháng phải ra 12/2025, không phải tháng 0 hay 13.
  t.bang('Giữ 2 tháng, đứng ở tháng 1 → lùi qua năm trước',
    mocThangLuuTru_(_luc_('2026-01-01T02:00'), 2), '2025-12');
  t.bang('Giữ 13 tháng, đứng ở tháng 1 → lùi trọn một năm',
    mocThangLuuTru_(_luc_('2026-01-01T02:00'), 13), '2025-01');
  // Ngày 31: Date.setMonth lùi từ 31/03 sẽ tràn sang 03/03, cách tính bằng tổng
  // số tháng thì không.
  t.bang('Ngày 31 không làm trôi tháng',
    mocThangLuuTru_(_luc_('2026-03-31T02:00'), 2), '2026-02');
  t.bang('Số tháng 0 vẫn coi như 1 — không bao giờ dọn tháng đang chạy',
    mocThangLuuTru_(_luc_('2026-09-11T02:00'), 0), '2026-09');

  // Dựng một dòng Su_Co giả: chỉ điền các cột phép tách thật sự đọc.
  function _dongLuuTru_(ngayCa, trangThai, kpiApDung, baoLuc) {
    const v = new Array(HEADER_SU_CO.length).fill('');
    v[COT.Ma_Su_Co] = 'SC-' + (ngayCa || 'x') + '-001';
    v[COT.Ngay_Ca] = ngayCa || '';
    v[COT.Trang_Thai] = trangThai;
    v[COT.KPI_Ap_Dung] = kpiApDung;
    if (baoLuc) v[COT.Thoi_Gian_Bao] = _luc_(baoLuc);
    return v;
  }
  function _dsMa_(ds) {
    return ds.map(function (v) { return v[COT.Ma_Su_Co]; });
  }

  const _dsLt_ = [
    _dongLuuTru_('2026-08-03', TRANG_THAI.HOAN_THANH, 'CO'),
    _dongLuuTru_('2026-08-04', TRANG_THAI.DANG_XU_LY, 'CO'),
    _dongLuuTru_('2026-09-02', TRANG_THAI.HOAN_THANH, 'CO'),
    _dongLuuTru_('2026-08-05', TRANG_THAI.HOAN_THANH, ''),
    _dongLuuTru_('2026-08-06', TRANG_THAI.HOAN_THANH, 'KHONG — phiếu DUNG_MAY'),
    _dongLuuTru_('', TRANG_THAI.HOAN_THANH, 'CO', '2026-07-09T10:00'),
    _dongLuuTru_('', TRANG_THAI.HOAN_THANH, 'CO'),
  ];
  const _lt_ = chonPhieuLuuTru_(_dsLt_, '2026-09');

  t.bang('Phiếu tháng trước đã xong thì dọn đi',
    _dsMa_(_lt_.luuTru).indexOf('SC-2026-08-03-001') >= 0, true);
  t.bang('Phiếu chưa đóng thì ở lại dù cũ',
    _dsMa_(_lt_.giuLai).indexOf('SC-2026-08-04-001') >= 0, true);
  t.bang('Phiếu tháng này ở lại',
    _dsMa_(_lt_.giuLai).indexOf('SC-2026-09-02-001') >= 0, true);
  t.bang('Phiếu chưa tính KPI lần nào thì giữ lại chờ tính',
    _dsMa_(_lt_.giuLai).indexOf('SC-2026-08-05-001') >= 0, true);
  t.bang('Và đếm đúng số phiếu giữ vì KPI', _lt_.giuViKpi, 1);
  // Phiếu không vào KPI vẫn có chữ trong KPI_Ap_Dung — không được nhầm thành
  // "chưa tính" rồi giữ lại vĩnh viễn.
  t.bang('Phiếu không đo KPI vẫn dọn được',
    _dsMa_(_lt_.luuTru).indexOf('SC-2026-08-06-001') >= 0, true);
  t.bang('Thiếu Ngay_Ca thì lấy tháng từ Thoi_Gian_Bao',
    _lt_.luuTru.length, 3);
  t.bang('Dòng không đọc được tháng thì giữ lại, không dọn mù',
    _dsMa_(_lt_.giuLai).indexOf('SC-x-001') >= 0, true);
  t.bang('Không phiếu nào biến mất giữa hai nhóm',
    _lt_.giuLai.length + _lt_.luuTru.length, _dsLt_.length);

  // Phiếu không đo được đáp ứng thì ô KPI trống là chuyện bình thường, không được
  // lấy đó làm cớ giữ lại — CV-/BT-/DM- chiếm gần một phần tư số phiếu mỗi tháng.
  function _dongLoai_(ma, loai) {
    const v = _dongLuuTru_('2026-08-10', TRANG_THAI.HOAN_THANH, '');
    v[COT.Ma_Su_Co] = ma;
    v[COT.Loai_Phieu] = loai;
    return v;
  }
  const _khongDo_ = chonPhieuLuuTru_([
    _dongLoai_('CV-1008-001', 'CONG_VIEC'),
    _dongLoai_('BT-1008-002', 'BAO_TRI'),
    _dongLoai_('DM-1008-003', 'DUNG_MAY'),
    _dongLoai_('SC-1008-004', 'SU_CO'),
  ], '2026-09');
  t.bang('Phiếu không đo KPI, ô trống vẫn dọn được',
    _dsMa_(_khongDo_.luuTru), ['CV-1008-001', 'BT-1008-002', 'DM-1008-003']);
  t.bang('Chỉ phiếu sự cố chưa tính KPI mới bị giữ lại',
    [_dsMa_(_khongDo_.giuLai), _khongDo_.giuViKpi], [['SC-1008-004'], 1]);

  // Biên tháng: phiếu đúng ngày cuối của tháng mốc phải ở lại.
  const _bien_ = chonPhieuLuuTru_([
    _dongLuuTru_('2026-09-01', TRANG_THAI.HOAN_THANH, 'CO'),
    _dongLuuTru_('2026-08-31', TRANG_THAI.HOAN_THANH, 'CO'),
  ], '2026-09');
  t.bang('01/09 ở lại, 31/08 đi', [_bien_.giuLai.length, _bien_.luuTru.length], [1, 1]);

  // ============================================================================
  // TỔ TRƯỞNG KHAI KẾ HOẠCH MÁY (KeHoachTo.gs) — bước 3/8
  // ============================================================================

  // --- xacThucTo_ --------------------------------------------------------
  const _dsTo_ = [
    { Bo_Phan: 'DET', Ten_To: 'Tổ Dệt', Ten_To_Truong: 'Phong', Token: 'tk-det', Hoat_Dong: true },
    { Bo_Phan: 'SOI', Ten_To: 'Tổ Sợi', Ten_To_Truong: 'Lan', Token: 'tk-soi', Hoat_Dong: false },
  ];
  t.bang('xacThucTo_ token đúng, bộ phận đúng → trả về tổ',
    !!xacThucTo_('DET', 'tk-det', _dsTo_), true);
  t.bang('xacThucTo_ token sai → null',
    xacThucTo_('DET', 'sai', _dsTo_), null);
  t.bang('xacThucTo_ đúng token nhưng khác bộ phận → null',
    xacThucTo_('SOI', 'tk-det', _dsTo_), null);
  t.bang('xacThucTo_ Hoat_Dong=false → null dù token đúng',
    xacThucTo_('SOI', 'tk-soi', _dsTo_), null);
  t.bang('xacThucTo_ không phân biệt hoa thường bộ phận',
    !!xacThucTo_('det', 'tk-det', _dsTo_), true);

  // --- dsMayCuaBoPhan_ -----------------------------------------------------
  const _dsMayGia_ = [
    { Ma_May: '4T-01', Ten_May: 'Máy 01', Bo_Phan: 'DET', Hoat_Dong: true },
    { Ma_May: '4T-02', Ten_May: 'Máy 02', Bo_Phan: 'DET', Hoat_Dong: false },
    { Ma_May: 'S-01', Ten_May: 'Máy Sợi 01', Bo_Phan: 'SOI', Hoat_Dong: true },
  ];
  t.bang('dsMayCuaBoPhan_ chỉ lấy đúng bộ phận + Hoat_Dong=TRUE',
    dsMayCuaBoPhan_('DET', _dsMayGia_), [{ maMay: '4T-01', tenMay: 'Máy 01' }]);
  t.bang('dsMayCuaBoPhan_ bộ phận không có máy nào → mảng rỗng',
    dsMayCuaBoPhan_('CO', _dsMayGia_), []);

  // --- lichHienHanhCuaTo_ ----------------------------------------------------
  const _dsLichTo_ = [
    { Bo_Phan: 'DET', Ap_Dung_Tu: '2026-09-01', Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '18:00',
      Co_Nghi_Trua: true, Nghi_Trua_Tu: '12:00', Nghi_Trua_Den: '13:00',
      Co_Ca_Dem: true, Ca_Dem_Tu: '18:00', Ca_Dem_Den: '07:00' },
    { Bo_Phan: 'DET', Ap_Dung_Tu: '2026-10-01', Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '18:00',
      Co_Nghi_Trua: true, Nghi_Trua_Tu: '11:30', Nghi_Trua_Den: '12:30',
      Co_Ca_Dem: true, Ca_Dem_Tu: '18:00', Ca_Dem_Den: '07:00' },
  ];
  t.bang('lichHienHanhCuaTo_ giữa tháng 9 → lấy lịch 01/09, không phải 01/10',
    lichHienHanhCuaTo_('DET', '2026-09-15', _dsLichTo_).Nghi_Trua_Tu, '12:00');
  t.bang('lichHienHanhCuaTo_ sau 01/10 → đổi sang lịch mới, lịch cũ vẫn còn nguyên trong dữ liệu',
    lichHienHanhCuaTo_('DET', '2026-10-05', _dsLichTo_).Nghi_Trua_Tu, '11:30');
  t.bang('lichHienHanhCuaTo_ đúng ngày Ap_Dung_Tu vẫn tính là hiện hành',
    lichHienHanhCuaTo_('DET', '2026-10-01', _dsLichTo_).Nghi_Trua_Tu, '11:30');
  t.bang('lichHienHanhCuaTo_ trước 01/09 → chưa có lịch nào → null',
    lichHienHanhCuaTo_('DET', '2026-08-31', _dsLichTo_), null);
  t.bang('lichHienHanhCuaTo_ bộ phận chưa khai lịch → null',
    lichHienHanhCuaTo_('SOI', '2026-09-15', _dsLichTo_), null);

  // --- chuanHoaPayloadLichTo_ ------------------------------------------------
  const _payloadDu_ = {
    apDungTu: '2026-09-01', caNgayTu: '07:00', caNgayDen: '18:00',
    coNghiTrua: true, nghiTruaTu: '12:00', nghiTruaDen: '13:00',
    coCaDem: true, caDemTu: '18:00', caDemDen: '07:00', ghiChu: 'Ghi chú test',
  };
  const _kqDu_ = chuanHoaPayloadLichTo_('DET', _payloadDu_);
  t.bang('chuanHoaPayloadLichTo_ đủ dữ liệu → ok, đúng thứ tự cột',
    [_kqDu_.ok, _kqDu_.dong[HEADER_LICH_TO.indexOf('Nghi_Trua_Tu')]], [true, '12:00']);
  t.bang('chuanHoaPayloadLichTo_ thiếu giờ ca ngày → lỗi',
    chuanHoaPayloadLichTo_('DET', { apDungTu: '2026-09-01' }).ok, false);
  t.bang('chuanHoaPayloadLichTo_ coNghiTrua=true nhưng thiếu giờ nghỉ trưa → lỗi',
    chuanHoaPayloadLichTo_('DET', {
      apDungTu: '2026-09-01', caNgayTu: '07:00', caNgayDen: '18:00', coNghiTrua: true,
    }).ok, false);
  t.bang('chuanHoaPayloadLichTo_ coCaDem=true nhưng thiếu giờ ca đêm → lỗi',
    chuanHoaPayloadLichTo_('DET', {
      apDungTu: '2026-09-01', caNgayTu: '07:00', caNgayDen: '18:00', coCaDem: true,
    }).ok, false);
  const _khongNghiKhongDem_ = chuanHoaPayloadLichTo_('DET', {
    apDungTu: '2026-09-01', caNgayTu: '07:00', caNgayDen: '17:00',
  });
  t.bang('chuanHoaPayloadLichTo_ không nghỉ trưa, không ca đêm → ok, các giờ liên quan để trống',
    [_khongNghiKhongDem_.ok, _khongNghiKhongDem_.dong[HEADER_LICH_TO.indexOf('Nghi_Trua_Tu')],
     _khongNghiKhongDem_.dong[HEADER_LICH_TO.indexOf('Ca_Dem_Tu')]],
    [true, '', '']);
  t.bang('chuanHoaPayloadLichTo_ ngày áp dụng sai định dạng → lỗi',
    chuanHoaPayloadLichTo_('DET', { apDungTu: '01/09/2026', caNgayTu: '07:00', caNgayDen: '18:00' }).ok, false);

  // --- timDongLichTrungApDung_ ------------------------------------------------
  const _vungLichTo_ = [
    ['DET', '2026-09-01', '07:00', '18:00', true, '12:00', '13:00', true, '18:00', '07:00', '', ''],
    ['SOI', '2026-09-01', '07:00', '17:00', false, '', '', false, '', '', '', ''],
  ];
  t.bang('timDongLichTrungApDung_ cùng Bo_Phan + Ap_Dung_Tu → đúng chỉ số dòng',
    timDongLichTrungApDung_(_vungLichTo_, 'DET', '2026-09-01'), 0);
  t.bang('timDongLichTrungApDung_ khác Ap_Dung_Tu → -1 (thêm dòng mới, không đụng dòng cũ)',
    timDongLichTrungApDung_(_vungLichTo_, 'DET', '2026-10-01'), -1);
  t.bang('timDongLichTrungApDung_ cùng Ap_Dung_Tu nhưng khác Bo_Phan → -1, không lẫn giữa các tổ',
    timDongLichTrungApDung_(_vungLichTo_, 'CO', '2026-09-01'), -1);

  // ============================================================================
  // KẾ HOẠCH MÁY THEO TUẦN (KeHoachTo.gs) — bước 5/8
  // ============================================================================

  // --- ngayTrongTuan_ ----------------------------------------------------
  t.bang('ngayTrongTuan_ đúng ngày đầu tuần → true',
    ngayTrongTuan_('2026-09-21', '2026-09-21'), true);
  t.bang('ngayTrongTuan_ đúng ngày cuối tuần (Chủ nhật, +6) → true',
    ngayTrongTuan_('2026-09-21', '2026-09-27'), true);
  t.bang('ngayTrongTuan_ trước tuần 1 ngày → false',
    ngayTrongTuan_('2026-09-21', '2026-09-20'), false);
  t.bang('ngayTrongTuan_ sau tuần 1 ngày → false',
    ngayTrongTuan_('2026-09-21', '2026-09-28'), false);

  // --- chuanHoaNgoaiLe_ ----------------------------------------------------
  const _dsLyDoGia_ = ['Thiếu đơn hàng', 'Thiếu thợ', 'Khác'];
  const _ngoaiLeDu_ = chuanHoaNgoaiLe_(
    { maMay: '4t-08', ngay: '2026-09-23', ca: 'n', lyDo: 'Thiếu đơn hàng', ghiChu: '' },
    'DET', '2026-09-21', _dsLyDoGia_);
  t.bang('chuanHoaNgoaiLe_ đủ dữ liệu hợp lệ → ok, chuẩn hoá hoa/thường',
    [_ngoaiLeDu_.ok, _ngoaiLeDu_.maMay, _ngoaiLeDu_.ca],
    [true, '4T-08', 'N']);
  t.bang('chuanHoaNgoaiLe_ thiếu mã máy → lỗi',
    chuanHoaNgoaiLe_({ ngay: '2026-09-23', ca: 'N', lyDo: 'Thiếu thợ' }, 'DET', '2026-09-21', _dsLyDoGia_).ok,
    false);
  t.bang('chuanHoaNgoaiLe_ ngày ngoài tuần → lỗi',
    chuanHoaNgoaiLe_({ maMay: '4T-08', ngay: '2026-10-01', ca: 'N', lyDo: 'Thiếu thợ' }, 'DET', '2026-09-21', _dsLyDoGia_).ok,
    false);
  t.bang('chuanHoaNgoaiLe_ ca sai → lỗi',
    chuanHoaNgoaiLe_({ maMay: '4T-08', ngay: '2026-09-23', ca: 'X', lyDo: 'Thiếu thợ' }, 'DET', '2026-09-21', _dsLyDoGia_).ok,
    false);
  t.bang('chuanHoaNgoaiLe_ thiếu lý do → lỗi',
    chuanHoaNgoaiLe_({ maMay: '4T-08', ngay: '2026-09-23', ca: 'N' }, 'DET', '2026-09-21', _dsLyDoGia_).ok,
    false);
  t.bang('chuanHoaNgoaiLe_ lý do ngoài danh sách cho phép → lỗi',
    chuanHoaNgoaiLe_({ maMay: '4T-08', ngay: '2026-09-23', ca: 'N', lyDo: 'Bịa ra' }, 'DET', '2026-09-21', _dsLyDoGia_).ok,
    false);
  t.bang('chuanHoaNgoaiLe_ lý do "Khác" thiếu ghi chú → lỗi',
    chuanHoaNgoaiLe_({ maMay: '4T-08', ngay: '2026-09-23', ca: 'N', lyDo: 'Khác' }, 'DET', '2026-09-21', _dsLyDoGia_).ok,
    false);
  t.bang('chuanHoaNgoaiLe_ lý do "Khác" có ghi chú → ok',
    chuanHoaNgoaiLe_({ maMay: '4T-08', ngay: '2026-09-23', ca: 'N', lyDo: 'Khác', ghiChu: 'Thợ vận hành nghỉ phép' }, 'DET', '2026-09-21', _dsLyDoGia_).ok,
    true);

  // --- chuanHoaDanhSachNgoaiLe_ ------------------------------------------
  const _dsMayHopLeGia_ = { '4T-08': true, '4T-12': true };
  const _dsOk_ = chuanHoaDanhSachNgoaiLe_([
    { maMay: '4T-08', ngay: '2026-09-21', ca: 'N', lyDo: 'Thiếu đơn hàng' },
    { maMay: '4T-12', ngay: '2026-09-24', ca: 'D', lyDo: 'Thiếu thợ' },
  ], 'DET', '2026-09-21', _dsMayHopLeGia_, _dsLyDoGia_);
  t.bang('chuanHoaDanhSachNgoaiLe_ danh sách hợp lệ → ok, đủ số dòng',
    [_dsOk_.ok, _dsOk_.dsDong.length], [true, 2]);
  t.bang('chuanHoaDanhSachNgoaiLe_ máy không thuộc bộ phận → lỗi',
    chuanHoaDanhSachNgoaiLe_([
      { maMay: 'S-99', ngay: '2026-09-21', ca: 'N', lyDo: 'Thiếu đơn hàng' },
    ], 'DET', '2026-09-21', _dsMayHopLeGia_, _dsLyDoGia_).ok, false);
  t.bang('chuanHoaDanhSachNgoaiLe_ khai trùng (ngày, ca, máy) trong cùng payload → lỗi',
    chuanHoaDanhSachNgoaiLe_([
      { maMay: '4T-08', ngay: '2026-09-21', ca: 'N', lyDo: 'Thiếu đơn hàng' },
      { maMay: '4T-08', ngay: '2026-09-21', ca: 'N', lyDo: 'Thiếu thợ' },
    ], 'DET', '2026-09-21', _dsMayHopLeGia_, _dsLyDoGia_).ok, false);
  t.bang('chuanHoaDanhSachNgoaiLe_ danh sách rỗng → ok, 0 dòng (bố trí tất cả máy chạy)',
    chuanHoaDanhSachNgoaiLe_([], 'DET', '2026-09-21', _dsMayHopLeGia_, _dsLyDoGia_),
    { ok: true, dsDong: [] });

  // --- tachDuLieuKeHoachTuan_ ----------------------------------------------
  function _dongKeHoach_(bp, tuan, maMay, trangThai, reqId) {
    const r = new Array(HEADER_KE_HOACH_MAY.length).fill('');
    r[HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau')] = tuan;
    r[HEADER_KE_HOACH_MAY.indexOf('Bo_Phan')] = bp;
    r[HEADER_KE_HOACH_MAY.indexOf('Ma_May')] = maMay;
    r[HEADER_KE_HOACH_MAY.indexOf('Trang_Thai')] = trangThai;
    r[HEADER_KE_HOACH_MAY.indexOf('Request_ID')] = reqId || '';
    return r;
  }
  const _vungKeHoach_ = [
    _dongKeHoach_('DET', '2026-09-14', '4T-01', 'DONG', ''),        // tuần TRƯỚC — phải giữ nguyên
    _dongKeHoach_('DET', '2026-09-14', '', 'DA_KHAI', 'req-tuan-truoc'),
    _dongKeHoach_('DET', '2026-09-21', '4T-08', 'DONG', 'req-cu'),  // tuần ĐANG XÉT — sẽ bị thay
    _dongKeHoach_('DET', '2026-09-21', '', 'DA_KHAI', 'req-cu'),
    _dongKeHoach_('SOI', '2026-09-21', 'S-01', 'DONG', ''),         // tổ KHÁC — phải giữ nguyên
  ];
  const _tach_ = tachDuLieuKeHoachTuan_(_vungKeHoach_, 'DET', '2026-09-21');
  t.bang('tachDuLieuKeHoachTuan_ giữ nguyên dòng tuần khác + tổ khác, bỏ đúng 2 dòng của tuần đang xét',
    _tach_.giuLai.length, 3);
  t.bang('tachDuLieuKeHoachTuan_ tìm đúng Request_ID của dòng DA_KHAI cũ',
    _tach_.daKhaiCu, { requestId: 'req-cu' });
  t.bang('tachDuLieuKeHoachTuan_ tuần chưa từng khai → daKhaiCu null',
    tachDuLieuKeHoachTuan_(_vungKeHoach_, 'DET', '2026-10-01').daKhaiCu, null);

  // ============================================================================
  // TỔ TRƯỞNG KHAI KẾ HOẠCH MÁY — bước 8/8: đối chiếu 22 test bắt buộc
  // (plan18.9.md mục 17). Phần lớn đã có test ở các khối phía trên (bước 3-5) —
  // đánh số ngay trong tên test để dễ đối chiếu với mục 17. Bốn mục dưới đây là
  // 4 mục còn thiếu test riêng, thêm mới ở bước này.
  //
  // Đối chiếu đầy đủ 22 mục (theo đúng thứ tự plan18.9.md mục 17):
  //  1. Token đúng → đọc được tổ            — xacThucTo_ (bước 3, trên)
  //  2. Token sai → từ chối                 — xacThucTo_ (bước 3, trên)
  //  3. Tổ DET không lấy máy SOI            — #3 dưới đây
  //  4. Chỉ lấy máy Hoat_Dong=TRUE          — dsMayCuaBoPhan_ (bước 3, trên)
  //  5. Lưu lịch lần đầu                    — chuanHoaPayloadLichTo_ + test tay bước 4
  //  6. Đổi lịch không phá lịch cũ          — timDongLichTrungApDung_/lichHienHanhCuaTo_ + test tay bước 4
  //  7. Lưu 60 máy chạy cả tuần             — chuanHoaDanhSachNgoaiLe_ danh sách rỗng (bước 5, trên)
  //  8. Đóng riêng một máy                  — chuanHoaNgoaiLe_ (bước 5, trên)
  //  9. Đóng máy cả tuần                    — #9 dưới đây
  // 10. Đóng riêng một ngày                 — chuanHoaNgoaiLe_ (bước 5, trên)
  // 11. Đóng riêng một ca                   — chuanHoaNgoaiLe_ (bước 5, trên)
  // 12. Đóng bắt buộc lý do                 — chuanHoaNgoaiLe_ (bước 5, trên)
  // 13. "Khác" bắt buộc ghi chú             — chuanHoaNgoaiLe_ (bước 5, trên)
  // 14. Bố trí chạy không cần lý do         — chuanHoaDanhSachNgoaiLe_ danh sách rỗng (bước 5, trên)
  // 15. Reload đọc đúng dữ liệu             — test tay bước 4/5/7a/7b (F5 xác nhận nhiều lần)
  // 16. Lưu trùng Ngay+Ca+Ma_May → upsert   — chuanHoaDanhSachNgoaiLe_ trùng + tachDuLieuKeHoachTuan_ + test tay bước 5
  // 17. Thao tác hàng loạt                  — test tay bước 7b (chọn nhiều máy, đóng/bố trí tất cả, sao chép)
  // 18. Ca đêm không làm lệch Ngay          — #18 dưới đây
  // 19. Chủ nhật khai bình thường           — #19 dưới đây
  // 20. Không đổi Hoat_Dong của máy         — xác nhận bằng đọc mã: không hàm nào trong KeHoachTo.gs ghi vào SHEET.MAY
  // 21. Không tạo dòng nào trong Su_Co      — xác nhận bằng đọc mã: không hàm nào trong KeHoachTo.gs tham chiếu SHEET.SU_CO
  // 22. Luồng QR hiện tại vẫn xanh          — toàn bộ 397 test trước đó (thợ/công nhân) vẫn chạy chung trong đúng lượt chayTest() này
  // ============================================================================

  // --- #3: tổ DET không lấy được máy thuộc bộ phận khác (SOI) ---------------
  const _dsMayHonHop_ = [
    { Ma_May: '4T-01', Ten_May: 'Máy 01', Bo_Phan: 'DET', Hoat_Dong: true },
    { Ma_May: 'S-01', Ten_May: 'Máy Sợi 01', Bo_Phan: 'SOI', Hoat_Dong: true },
  ];
  t.bang('#3 tổ DET không lấy được máy thuộc bộ phận SOI',
    dsMayCuaBoPhan_('DET', _dsMayHonHop_).some(function (m) { return m.maMay === 'S-01'; }), false);

  // --- #9: đóng máy CẢ TUẦN (7 ngày × 2 ca = 14 lượt cho một máy) ------------
  const _tuanBatDau89_ = '2026-09-21';
  const _ngayCaTuan89_ = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
    '2026-09-25', '2026-09-26', '2026-09-27'];
  const _dsCaTuan_ = [];
  _ngayCaTuan89_.forEach(function (ngay) {
    _dsCaTuan_.push({ maMay: '4T-08', ngay: ngay, ca: 'N', lyDo: 'Thiếu đơn hàng' });
    _dsCaTuan_.push({ maMay: '4T-08', ngay: ngay, ca: 'D', lyDo: 'Thiếu đơn hàng' });
  });
  const _kqCaTuan_ = chuanHoaDanhSachNgoaiLe_(
    _dsCaTuan_, 'DET', _tuanBatDau89_, { '4T-08': true }, _dsLyDoGia_);
  t.bang('#9 đóng máy cả tuần (7 ngày × 2 ca) → ok, đủ 14 dòng',
    [_kqCaTuan_.ok, _kqCaTuan_.dsDong.length], [true, 14]);

  // --- #18: ca đêm ở ngày cuối tuần không làm lệch Ngay đã chọn --------------
  const _caDemCuoiTuan_ = chuanHoaNgoaiLe_(
    { maMay: '4T-08', ngay: '2026-09-27', ca: 'D', lyDo: 'Thiếu thợ' },
    'DET', '2026-09-21', _dsLyDoGia_);
  t.bang('#18 ca đêm ngày cuối tuần vẫn giữ đúng Ngay đã chọn, không lệch qua tuần sau',
    [_caDemCuoiTuan_.ok, _caDemCuoiTuan_.ngay], [true, '2026-09-27']);

  // --- #19: Chủ nhật khai đóng máy bình thường, không bị chặn riêng ----------
  const _chuNhat19_ = chuanHoaNgoaiLe_(
    { maMay: '4T-08', ngay: '2026-09-27', ca: 'N', lyDo: 'Thiếu đơn hàng' },
    'DET', '2026-09-21', _dsLyDoGia_);
  t.bang('#19 Chủ nhật khai đóng máy bình thường như mọi ngày khác',
    _chuNhat19_.ok, true);

  // ============================================================================
  // TĂNG CA THEO MÁY — bước 1: cấu hình giờ + hàm thuần tính khung kế hoạch
  // ============================================================================
  const _lichTC_ = {
    Bo_Phan: 'DET', Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '16:30',
    Co_Nghi_Trua: true, Nghi_Trua_Tu: '11:30', Nghi_Trua_Den: '12:15',
  };
  const _gioMacDinh_ = gioTangCa_({});
  t.bang('gioTangCa_ khoá thiếu → mặc định 20:30, nghỉ tối 17:00–18:00',
    _gioMacDinh_, { den: 1230, nghiToiTu: 1020, nghiToiDen: 1080 });
  t.bang('gioTangCa_ đọc đúng giá trị cấu hình',
    gioTangCa_({ TANG_CA_DEN: '21:00', NGHI_TOI_TU: '17:30', NGHI_TOI_DEN: '18:15' }),
    { den: 1260, nghiToiTu: 1050, nghiToiDen: 1095 });
  t.bang('gioTangCa_ hai ô nghỉ tối để trống → tắt nghỉ tối',
    gioTangCa_({ TANG_CA_DEN: '20:30', NGHI_TOI_TU: '', NGHI_TOI_DEN: '' }),
    { den: 1230, nghiToiTu: null, nghiToiDen: null });
  t.bang('gioTangCa_ giờ sai định dạng → rơi về mặc định',
    gioTangCa_({ TANG_CA_DEN: 'abc', NGHI_TOI_TU: '18:00', NGHI_TOI_DEN: '17:00' }),
    { den: 1230, nghiToiTu: 1020, nghiToiDen: 1080 });

  t.bang('truKhoangNghi_ trừ hai khoảng nghỉ ở giữa',
    truKhoangNghi_(420, 1230, [[1020, 1080], [690, 735]]),
    [[420, 690], [735, 1020], [1080, 1230]]);
  t.bang('truKhoangNghi_ khoảng nghỉ chồng nhau không bị trừ hai lần',
    truKhoangNghi_(0, 100, [[10, 30], [20, 40]]), [[0, 10], [40, 100]]);
  t.bang('truKhoangNghi_ khoảng nghỉ nằm ngoài khung bị bỏ qua',
    truKhoangNghi_(100, 200, [[0, 50], [300, 400]]), [[100, 200]]);

  const _ngayThuong_ = khungKeHoachNgayCuaMay_(_lichTC_);
  t.bang('ca ngày 07:00–16:30 trừ nghỉ trưa 45 phút = 525 phút',
    [_ngayThuong_.tongPhut, _ngayThuong_.hetCa], [525, 990]);
  t.bang('tổ chưa khai lịch → null, không suy diễn giờ mặc định',
    [khungKeHoachNgayCuaMay_(null), khungTangCaCuaMay_(null, _gioMacDinh_)], [null, null]);

  // BA MỐC (22/09/2026): tăng ca là mốc riêng, không kéo dài ca ngày
  const _kTang_ = khungTangCaCuaMay_(_lichTC_, _gioMacDinh_);
  t.bang('3 MỐC: tăng ca là mốc riêng 18:00–20:30 = 150 phút (sau nghỉ tối), không nối từ ca ngày',
    [_kTang_.khung, _kTang_.tongPhut, _kTang_.hetCa], [[[1080, 1230]], 150, 1230]);
  t.bang('3 MỐC: tổ hết ca ngày 17:00 (CMTX) → tăng ca vẫn 18:00–20:30; tổ hết ca 18:00 (DET) → 18:00–20:30, không trừ oan',
    [khungTangCaCuaMay_({ Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '17:00', Co_Nghi_Trua: false }, _gioMacDinh_).khung,
     khungTangCaCuaMay_({ Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '18:00', Co_Nghi_Trua: false }, _gioMacDinh_).khung],
    [[[1080, 1230]], [[1080, 1230]]]);
  t.bang('3 MỐC: tổ hết ca ngày sau nghỉ tối (19:00) → tăng ca bắt đầu lúc hết ca ngày',
    khungTangCaCuaMay_({ Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '19:00', Co_Nghi_Trua: false }, _gioMacDinh_).khung,
    [[1140, 1230]]);
  t.bang('3 MỐC: tắt nghỉ tối → tăng ca bắt đầu ngay lúc hết ca ngày (16:30–20:30 = 240)',
    khungTangCaCuaMay_(_lichTC_, { den: 1230, nghiToiTu: null, nghiToiDen: null }).tongPhut, 240);
  t.bang('3 MỐC: giờ hết tăng ca không sau giờ bắt đầu → không có khung tăng ca (null)',
    khungTangCaCuaMay_(_lichTC_, { den: 900, nghiToiTu: null, nghiToiDen: null }), null);

  // ============================================================================
  // TĂNG CA THEO MÁY — bước 2: lưu / đọc dòng TANG_CA trong Ke_Hoach_May
  // ============================================================================
  const _tc_ = chuanHoaTangCa_({ maMay: ' 4t-08 ', ngay: '2026-09-23' }, 'det', '2026-09-21');
  t.bang('chuanHoaTangCa_ hợp lệ → ok, chuẩn hoá hoa/thường',
    [_tc_.ok, _tc_.maMay, _tc_.ngay], [true, '4T-08', '2026-09-23']);
  t.bang('chuanHoaTangCa_ dòng ghi ra: Trang_Thai TANG_CA, Ca T (mốc tăng ca), Bo_Phan hoa, không lý do',
    [
      _tc_.dong[HEADER_KE_HOACH_MAY.indexOf('Trang_Thai')],
      _tc_.dong[HEADER_KE_HOACH_MAY.indexOf('Ca')],
      _tc_.dong[HEADER_KE_HOACH_MAY.indexOf('Bo_Phan')],
      _tc_.dong[HEADER_KE_HOACH_MAY.indexOf('Ly_Do')],
      _tc_.dong.length,
    ],
    ['TANG_CA', 'T', 'DET', '', HEADER_KE_HOACH_MAY.length]);
  t.bang('chuanHoaTangCa_ thiếu mã máy → lỗi',
    chuanHoaTangCa_({ ngay: '2026-09-23' }, 'DET', '2026-09-21').ok, false);
  t.bang('chuanHoaTangCa_ ngày sai định dạng → lỗi',
    chuanHoaTangCa_({ maMay: '4T-08', ngay: 'abc' }, 'DET', '2026-09-21').ok, false);
  t.bang('chuanHoaTangCa_ ngày ngoài tuần → lỗi',
    chuanHoaTangCa_({ maMay: '4T-08', ngay: '2026-09-28' }, 'DET', '2026-09-21').ok, false);
  t.bang('chuanHoaTangCa_ Chủ nhật cuối tuần vẫn hợp lệ',
    chuanHoaTangCa_({ maMay: '4T-08', ngay: '2026-09-27' }, 'DET', '2026-09-21').ok, true);

  const _dongNgoaiLeTC_ = chuanHoaDanhSachNgoaiLe_([
    { maMay: '4T-08', ngay: '2026-09-22', ca: 'N', lyDo: 'Thiếu thợ' },
    { maMay: '4T-12', ngay: '2026-09-23', ca: 'D', lyDo: 'Thiếu thợ' },
  ], 'DET', '2026-09-21', _dsMayHopLeGia_, _dsLyDoGia_).dsDong;

  const _dsTcOk_ = chuanHoaDanhSachTangCa_([
    { maMay: '4T-08', ngay: '2026-09-23' },
    { maMay: '4T-12', ngay: '2026-09-23' },
  ], 'DET', '2026-09-21', _dsMayHopLeGia_, null);
  t.bang('chuanHoaDanhSachTangCa_ hợp lệ → ok, đủ số dòng',
    [_dsTcOk_.ok, _dsTcOk_.dsDong.length], [true, 2]);
  t.bang('chuanHoaDanhSachTangCa_ danh sách rỗng / không phải mảng → ok, 0 dòng',
    [chuanHoaDanhSachTangCa_([], 'DET', '2026-09-21', _dsMayHopLeGia_, []).dsDong.length,
     chuanHoaDanhSachTangCa_(undefined, 'DET', '2026-09-21', _dsMayHopLeGia_, []).ok],
    [0, true]);
  t.bang('chuanHoaDanhSachTangCa_ máy thuộc bộ phận khác → lỗi',
    chuanHoaDanhSachTangCa_([{ maMay: 'S-01', ngay: '2026-09-23' }],
      'DET', '2026-09-21', _dsMayHopLeGia_, []).ok, false);
  t.bang('chuanHoaDanhSachTangCa_ khai trùng (máy, ngày) → lỗi',
    chuanHoaDanhSachTangCa_([
      { maMay: '4T-08', ngay: '2026-09-23' }, { maMay: '4t-08', ngay: '2026-09-23' },
    ], 'DET', '2026-09-21', _dsMayHopLeGia_, []).ok, false);
  t.bang('3 MỐC: máy ĐÓNG ca ngày vẫn tăng ca được cùng ngày (MCQ06: nghỉ giờ hành chính, tối tăng ca)',
    [_dongNgoaiLeTC_.length, chuanHoaDanhSachTangCa_([{ maMay: '4T-08', ngay: '2026-09-22' }],
      'DET', '2026-09-21', _dsMayHopLeGia_, null).ok], [2, true]);
  const _lyDoThay_ = ['Thợ vắng ca đêm', 'Khác'];
  const _iLy_ = HEADER_KE_HOACH_MAY.indexOf('Ly_Do');
  t.bang('tổ luôn chạy ca đêm: tăng ca không gửi lý do → lấy lý do đầu tiên "Thợ vắng ca đêm"',
    chuanHoaDanhSachTangCa_([{ maMay: '4T-08', ngay: '2026-09-23' }],
      'DET', '2026-09-21', _dsMayHopLeGia_, _lyDoThay_).dsDong[0][_iLy_], 'Thợ vắng ca đêm');
  t.bang('tổ luôn chạy ca đêm: lý do trong danh sách giữ nguyên; lý do lạ → lỗi',
    [chuanHoaDanhSachTangCa_([{ maMay: '4T-08', ngay: '2026-09-23', lyDo: 'Khác' }],
      'DET', '2026-09-21', _dsMayHopLeGia_, _lyDoThay_).dsDong[0][_iLy_],
     chuanHoaDanhSachTangCa_([{ maMay: '4T-08', ngay: '2026-09-23', lyDo: 'Bịa ra' }],
      'DET', '2026-09-21', _dsMayHopLeGia_, _lyDoThay_).ok], ['Khác', false]);
  t.bang('tổ khác (không truyền danh sách lý do): tăng ca KHÔNG ghi lý do dù client có gửi',
    chuanHoaDanhSachTangCa_([{ maMay: '4T-08', ngay: '2026-09-23', lyDo: 'Khác' }],
      'DET', '2026-09-21', _dsMayHopLeGia_, null).dsDong[0][_iLy_], '');
  t.bang('dsLyDoTangCaThayCaDem_ khoá thiếu → "Thợ vắng ca đêm"; đọc cấu hình, bỏ ô rỗng',
    [dsLyDoTangCaThayCaDem_({}), dsLyDoTangCaThayCaDem_({ LY_DO_TANG_CA_THAY_CA_DEM: ' A , ,B ' })],
    [['Thợ vắng ca đêm'], ['A', 'B']]);

  // tach: dòng TANG_CA của đúng tuần bị bỏ khỏi giuLai và được trả riêng ở tangCaCu
  const _iTt_ = HEADER_KE_HOACH_MAY.indexOf('Trang_Thai');
  const _vungTC_ = [
    _dongKeHoach_('DET', '2026-09-14', '4T-01', 'TANG_CA', ''),   // tuần trước — giữ
    _dongKeHoach_('DET', '2026-09-21', '4T-08', 'TANG_CA', 'req-cu'),
    _dongKeHoach_('DET', '2026-09-21', '', 'DA_KHAI', 'req-cu'),
    _dongKeHoach_('SOI', '2026-09-21', 'S-01', 'TANG_CA', ''),    // tổ khác — giữ
  ];
  const _tachTC_ = tachDuLieuKeHoachTuan_(_vungTC_, 'DET', '2026-09-21');
  t.bang('tachDuLieuKeHoachTuan_ TANG_CA của đúng tuần/tổ vào tangCaCu, tuần khác + tổ khác giữ nguyên',
    [_tachTC_.giuLai.length, _tachTC_.tangCaCu.length, _tachTC_.tangCaCu[0][_iTt_]],
    [2, 1, 'TANG_CA']);

  // lay: TANG_CA phải ra riêng, KHÔNG lẫn vào ngoaiLe (client vẽ "Đóng máy" từ ngoaiLe)
  function _objKeHoach_(bp, tuan, maMay, trangThai, ngay, ca, lyDo) {
    return { Bo_Phan: bp, Tuan_Bat_Dau: tuan, Ma_May: maMay, Trang_Thai: trangThai,
      Ngay: ngay, Ca: ca, Ly_Do: lyDo || '', Ghi_Chu: '' };
  }
  const _plTC_ = phanLoaiDongKeHoach_([
    _objKeHoach_('DET', '2026-09-21', '4T-08', 'DONG', '2026-09-22', 'N', 'Thiếu thợ'),
    _objKeHoach_('DET', '2026-09-21', '4T-08', 'TANG_CA', '2026-09-23', 'N'),
    _objKeHoach_('DET', '2026-09-21', '', 'DA_KHAI', '', ''),
    _objKeHoach_('DET', '2026-09-14', '4T-01', 'TANG_CA', '2026-09-16', 'N'),   // tuần khác
    _objKeHoach_('SOI', '2026-09-21', 'S-01', 'TANG_CA', '2026-09-23', 'N'),    // tổ khác
  ], 'DET', '2026-09-21');
  t.bang('phanLoaiDongKeHoach_ TANG_CA ra riêng, không lẫn vào ngoaiLe, lọc đúng tổ + tuần',
    [_plTC_.daKhai, _plTC_.ngoaiLe.length, _plTC_.tangCa],
    [true, 1, [{ maMay: '4T-08', ngay: '2026-09-23', lyDo: '' }]]);
  t.bang('phanLoaiDongKeHoach_ tuần chưa khai → daKhai false, không có tăng ca',
    phanLoaiDongKeHoach_([], 'DET', '2026-09-21'),
    { daKhai: false, ngoaiLe: [], tangCa: [], veGiuaCa: [], chayDem: [] });

  // ============================================================================
  // VỀ GIỮA CA (tổ trưởng ghi) — bước 1: cột mới, cấu hình lý do, hàm tính phút mất
  // ============================================================================
  t.bang('Ke_Hoach_May có 2 cột mới ở CUỐI: Gio_Ve, Gio_Quay_Lai',
    HEADER_KE_HOACH_MAY.slice(-2), ['Gio_Ve', 'Gio_Quay_Lai']);
  t.bang('cột Request_ID vẫn ở vị trí cũ (chỉ thêm cuối, không xê dịch)',
    HEADER_KE_HOACH_MAY.indexOf('Request_ID'), 10);
  t.bang('TRANG_THAI_KE_HOACH_MAY có VE_GIUA_CA',
    TRANG_THAI_KE_HOACH_MAY.VE_GIUA_CA, 'VE_GIUA_CA');
  t.bang('dsLyDoVeGiuaCa_ khoá thiếu → mặc định đúng 2 lý do',
    dsLyDoVeGiuaCa_({}), ['Nghỉ có phép', 'Nghỉ không phép']);
  t.bang('dsLyDoVeGiuaCa_ đọc cấu hình, bỏ khoảng trắng và ô rỗng',
    dsLyDoVeGiuaCa_({ LY_DO_VE_GIUA_CA: ' A , B ,, C ' }), ['A', 'B', 'C']);

  const _lichVe_ = {
    Bo_Phan: 'DET', Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '16:30',
    Co_Nghi_Trua: true, Nghi_Trua_Tu: '11:30', Nghi_Trua_Den: '12:15',
    Co_Ca_Dem: true, Ca_Dem_Tu: '16:30', Ca_Dem_Den: '07:00',
  };
  const _lichVeKhongDem_ = {
    Bo_Phan: 'DET', Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '16:30',
    Co_Nghi_Trua: true, Nghi_Trua_Tu: '11:30', Nghi_Trua_Den: '12:15', Co_Ca_Dem: false,
  };

  t.bang('khungCaDemCuaMay_ 16:30→07:00 qua nửa đêm = 870 phút, hết ca 07:00 hôm sau (1860)',
    (function () { const k = khungCaDemCuaMay_(_lichVe_); return [k.tongPhut, k.hetCa]; })(),
    [870, 1860]);
  t.bang('khungCaDemCuaMay_ tổ không có ca đêm → null',
    khungCaDemCuaMay_(_lichVeKhongDem_), null);
  t.bang('gioTrenTrucCa_ giờ sau nửa đêm được cộng 1440',
    [gioTrenTrucCa_('23:00', 990), gioTrenTrucCa_('02:00', 990), gioTrenTrucCa_('xx', 990)],
    [1380, 1560, null]);
  t.bang('phutGiaoKhung_ cắt đúng phần giao, không âm',
    [phutGiaoKhung_([[420, 690], [735, 990]], 600, 800), phutGiaoKhung_([[420, 690]], 700, 800)],
    [90 + 65, 0]);

  const _ve1_ = tinhVeGiuaCa_(_lichVe_, 'N', '14:00', '', _gioMacDinh_);
  t.bang('về 14:00 đến hết ca 16:30 = 150 phút mất',
    [_ve1_.ok, _ve1_.phutMat, _ve1_.hetCa], [true, 150, 990]);
  t.bang('về 11:00: nghỉ trưa 45 phút KHÔNG tính là mất → 330 − 45 = 285',
    tinhVeGiuaCa_(_lichVe_, 'N', '11:00', '', _gioMacDinh_).phutMat, 285);
  t.bang('3 MỐC: về 16:00 ở ca ngày chỉ mất tới hết ca ngày 16:30 (30), tăng ca là mốc riêng',
    tinhVeGiuaCa_(_lichVe_, 'N', '16:00', '', _gioMacDinh_).phutMat, 30);
  t.bang('quay lại sớm: về 11:00, quay lại 13:00 → 30 + 45 = 75 phút',
    tinhVeGiuaCa_(_lichVe_, 'N', '11:00', '13:00', _gioMacDinh_).phutMat, 75);
  t.bang('về đúng giờ bắt đầu ca = mất cả ca (525 phút)',
    tinhVeGiuaCa_(_lichVe_, 'N', '07:00', '', _gioMacDinh_).phutMat, 525);

  t.bang('giờ về trước khi vào ca → lỗi',
    tinhVeGiuaCa_(_lichVe_, 'N', '06:00', '', _gioMacDinh_).ok, false);
  t.bang('giờ về đúng lúc hết ca → lỗi (không còn gì để mất)',
    tinhVeGiuaCa_(_lichVe_, 'N', '16:30', '', _gioMacDinh_).ok, false);
  t.bang('giờ về sai định dạng → lỗi',
    tinhVeGiuaCa_(_lichVe_, 'N', 'abc', '', _gioMacDinh_).ok, false);
  t.bang('giờ quay lại không sau giờ về → lỗi',
    tinhVeGiuaCa_(_lichVe_, 'N', '14:00', '13:00', _gioMacDinh_).ok, false);
  t.bang('giờ quay lại sau hết ca → lỗi',
    tinhVeGiuaCa_(_lichVe_, 'N', '14:00', '17:00', _gioMacDinh_).ok, false);
  t.bang('tổ chưa khai lịch → lỗi rõ ràng, không suy diễn giờ',
    tinhVeGiuaCa_(null, 'N', '14:00', '', _gioMacDinh_),
    { ok: false, error: 'Tổ chưa khai giờ làm việc.' });
  t.bang('ca không hợp lệ → lỗi',
    tinhVeGiuaCa_(_lichVe_, 'X', '14:00', '', _gioMacDinh_).ok, false);

  t.bang('CA ĐÊM: về 23:00 đến hết ca 07:00 hôm sau = 480 phút',
    tinhVeGiuaCa_(_lichVe_, 'D', '23:00', '', _gioMacDinh_).phutMat, 480);
  t.bang('CA ĐÊM: về lúc 02:00 sáng (sau nửa đêm) = 300 phút, không lệch ngày',
    tinhVeGiuaCa_(_lichVe_, 'D', '02:00', '', _gioMacDinh_).phutMat, 300);
  t.bang('CA ĐÊM: về 23:00, quay lại 01:00 sáng = 120 phút',
    tinhVeGiuaCa_(_lichVe_, 'D', '23:00', '01:00', _gioMacDinh_).phutMat, 120);
  t.bang('CA ĐÊM: tổ không có ca đêm → lỗi',
    tinhVeGiuaCa_(_lichVeKhongDem_, 'D', '23:00', '', _gioMacDinh_).ok, false);

  t.bang('3 MỐC TĂNG CA: về 19:00 → mất tới hết tăng ca 20:30 = 90 phút',
    tinhVeGiuaCa_(_lichVe_, 'T', '19:00', '', _gioMacDinh_).phutMat, 90);
  t.bang('3 MỐC TĂNG CA: về 19:00, quay lại 20:00 → 60 phút',
    tinhVeGiuaCa_(_lichVe_, 'T', '19:00', '20:00', _gioMacDinh_).phutMat, 60);
  t.bang('3 MỐC TĂNG CA: về trong giờ nghỉ tối (17:30) = bỏ cả mốc tăng ca (150)',
    tinhVeGiuaCa_(_lichVe_, 'T', '17:30', '', _gioMacDinh_).phutMat, 150);
  t.bang('3 MỐC TĂNG CA: giờ về sau hết tăng ca / trong ca ngày → lỗi ngoài ca',
    [tinhVeGiuaCa_(_lichVe_, 'T', '21:00', '', _gioMacDinh_).ok, tinhVeGiuaCa_(_lichVe_, 'T', '10:00', '', _gioMacDinh_).ok],
    [false, false]);
  t.bang('caThatCuaVeGiuaCa_ ghi ca ngày mà về lúc đã sang giờ tăng ca (hoặc nghỉ tối) → mốc T',
    [caThatCuaVeGiuaCa_('N', '19:00', _lichVe_, true, _gioMacDinh_),
     caThatCuaVeGiuaCa_('N', '17:00', _lichVe_, true, _gioMacDinh_),
     caThatCuaVeGiuaCa_('N', '16:00', _lichVe_, true, _gioMacDinh_),
     caThatCuaVeGiuaCa_('N', '19:00', _lichVe_, false, _gioMacDinh_),
     caThatCuaVeGiuaCa_('D', '19:00', _lichVe_, true, _gioMacDinh_)],
    ['T', 'T', 'N', 'N', 'D']);

  // ============================================================================
  // VỀ GIỮA CA (tổ trưởng ghi) — bước 2: chuẩn hoá, giữ lại khi lưu tuần, đọc ra riêng
  // ============================================================================
  t.bang('thuHaiCuaNgay_ thứ Bảy 19/09 → thứ Hai 14/09',
    thuHaiCuaNgay_('2026-09-19'), '2026-09-14');
  t.bang('thuHaiCuaNgay_ Chủ nhật 20/09 vẫn thuộc tuần bắt đầu 14/09',
    thuHaiCuaNgay_('2026-09-20'), '2026-09-14');
  t.bang('thuHaiCuaNgay_ đúng thứ Hai → chính nó; qua năm 01/01/2026 (thứ Năm) → 29/12/2025',
    [thuHaiCuaNgay_('2026-09-21'), thuHaiCuaNgay_('2026-01-01')], ['2026-09-21', '2025-12-29']);

  const _ctxVe_ = {
    boPhan: 'det',
    maMayHopLe: { '4T-01': true, '4T-02': true, '4T-03': true },
    homNay: '2026-09-19',
    lich: _lichVe_,
    tangCa: { '4T-03|2026-09-19': true },
    chayDem: { '4T-01|2026-09-19': true, '4T-02|2026-09-19': true },
    dangDong: { '4T-02|2026-09-19|N': true },
    dsLyDo: ['Nghỉ có phép', 'Nghỉ không phép'],
    gioTangCa: _gioMacDinh_,
  };
  function _pVe_(sua) {
    const p = { dsMay: ['4T-01'], ngay: '2026-09-19', ca: 'N', lyDo: 'Nghỉ có phép', gioVe: '14:00', gioQuayLai: '' };
    Object.keys(sua || {}).forEach(function (k) { p[k] = sua[k]; });
    return p;
  }

  const _ve2_ = chuanHoaDanhSachVeGiuaCa_(_pVe_(), _ctxVe_);
  t.bang('về giữa ca hợp lệ 1 máy → ok, 150 phút mất, tuần bắt đầu đúng thứ Hai',
    [_ve2_.ok, _ve2_.ketQua, _ve2_.tuanBatDau], [true, [{ maMay: '4T-01', ca: 'N', phutMat: 150 }], '2026-09-14']);
  t.bang('dòng ghi ra: VE_GIUA_CA, Ca, Ma_May hoa, Bo_Phan hoa, Ly_Do, Gio_Ve, không giờ quay lại',
    (function () {
      const d = _ve2_.dsDong[0]; const h = HEADER_KE_HOACH_MAY;
      return [d[h.indexOf('Trang_Thai')], d[h.indexOf('Ca')], d[h.indexOf('Ma_May')],
        d[h.indexOf('Bo_Phan')], d[h.indexOf('Ly_Do')], d[h.indexOf('Gio_Ve')],
        d[h.indexOf('Gio_Quay_Lai')], d.length];
    })(),
    ['VE_GIUA_CA', 'N', '4T-01', 'DET', 'Nghỉ có phép', '14:00', '', HEADER_KE_HOACH_MAY.length]);

  const _veNhieu_ = chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4t-01', '4T-03'], gioVe: '16:00' }), _ctxVe_);
  t.bang('nhiều máy về 16:00 ca ngày: máy tăng ca 4T-03 cũng chỉ mất tới hết ca ngày (30), như 4T-01',
    _veNhieu_.ketQua, [{ maMay: '4T-01', ca: 'N', phutMat: 30 }, { maMay: '4T-03', ca: 'N', phutMat: 30 }]);
  const _veToi_ = chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-03'], gioVe: '19:00' }), _ctxVe_);
  t.bang('3 MỐC: chọn ca ngày mà về 19:00 ở máy tăng ca → tự tính theo mốc tăng ca (90), dòng ghi Ca T',
    [_veToi_.ketQua, _veToi_.dsDong[0][HEADER_KE_HOACH_MAY.indexOf('Ca')]], [[{ maMay: '4T-03', ca: 'T', phutMat: 90 }], 'T']);
  t.bang('3 MỐC: chọn mốc Tăng ca cho máy KHÔNG tăng ca → lỗi',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01'], ca: 'T', gioVe: '19:00' }), _ctxVe_).error,
    'Máy 4T-01 không tăng ca ngày 2026-09-19.');
  t.bang('3 MỐC: máy ĐÓNG ca ngày mà có tăng ca vẫn ghi về giữa ca ở mốc tăng ca',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-03'], ca: 'T', gioVe: '19:00' }),
      Object.assign({}, _ctxVe_, { dangDong: { '4T-03|2026-09-19|N': true } })).ok, true);

  t.bang('ngày chưa tới → lỗi', chuanHoaDanhSachVeGiuaCa_(_pVe_({ ngay: '2026-09-20' }), _ctxVe_).ok, false);
  t.bang('ngày sai định dạng → lỗi', chuanHoaDanhSachVeGiuaCa_(_pVe_({ ngay: 'abc' }), _ctxVe_).ok, false);
  t.bang('ca sai → lỗi', chuanHoaDanhSachVeGiuaCa_(_pVe_({ ca: 'X' }), _ctxVe_).ok, false);
  t.bang('thiếu lý do → lỗi', chuanHoaDanhSachVeGiuaCa_(_pVe_({ lyDo: '' }), _ctxVe_).ok, false);
  t.bang('lý do ngoài danh sách (Nghỉ có phép / Nghỉ không phép) → lỗi',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ lyDo: 'Bịa ra' }), _ctxVe_).ok, false);
  t.bang('lý do "Nghỉ không phép" hợp lệ',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ lyDo: 'Nghỉ không phép' }), _ctxVe_).ok, true);
  t.bang('không chọn máy → lỗi', chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: [] }), _ctxVe_).ok, false);
  t.bang('máy thuộc tổ khác → lỗi', chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['S-01'] }), _ctxVe_).ok, false);
  t.bang('chọn trùng máy → lỗi',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01', '4t-01'] }), _ctxVe_).ok, false);
  t.bang('máy đang ĐÓNG ca ngày hôm đó → lỗi (một máy-ngày-ca một trạng thái)',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-02'] }), _ctxVe_).ok, false);
  t.bang('máy đóng CA NGÀY vẫn về giữa ca được ở CA ĐÊM (tổ có ca đêm)',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-02'], ca: 'D', gioVe: '23:00' }), _ctxVe_).ok, true);
  t.bang('tổ chưa khai lịch → lỗi',
    chuanHoaDanhSachVeGiuaCa_(_pVe_(), Object.assign({}, _ctxVe_, { lich: null })).error,
    'Máy 4T-01: Tổ chưa khai giờ làm việc.');
  t.bang('giờ về ngoài ca → lỗi', chuanHoaDanhSachVeGiuaCa_(_pVe_({ gioVe: '06:00' }), _ctxVe_).ok, false);
  t.bang('HẾT-HOẶC-KHÔNG: một máy lỗi thì cả lượt không ghi dòng nào',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01', '4T-02'] }), _ctxVe_).dsDong, undefined);

  // đọc ngữ cảnh + tìm dòng + giữ khi lưu tuần
  const _vungVe_ = [
    _dongKeHoach_('DET', '2026-09-14', '4T-02', 'DONG', ''),
    _dongKeHoach_('DET', '2026-09-14', '4T-03', 'TANG_CA', ''),
    _dongKeHoach_('DET', '2026-09-14', '4T-01', 'VE_GIUA_CA', 'rq-ve'),
    _dongKeHoach_('DET', '2026-09-14', '', 'DA_KHAI', 'rq-tuan'),
    _dongKeHoach_('SOI', '2026-09-14', 'S-01', 'VE_GIUA_CA', ''),
  ];
  const _iNg_ = HEADER_KE_HOACH_MAY.indexOf('Ngay');
  const _iCa_ = HEADER_KE_HOACH_MAY.indexOf('Ca');
  _vungVe_[0][_iNg_] = '2026-09-19'; _vungVe_[0][_iCa_] = 'N';
  _vungVe_[1][_iNg_] = '2026-09-19'; _vungVe_[1][_iCa_] = 'N';
  _vungVe_[2][_iNg_] = '2026-09-19'; _vungVe_[2][_iCa_] = 'N';
  _vungVe_[4][_iNg_] = '2026-09-19'; _vungVe_[4][_iCa_] = 'N';

  t.bang('docNguCanhVeGiuaCa_ nhận đúng máy đang đóng + máy tăng ca của đúng tổ/ngày',
    docNguCanhVeGiuaCa_(_vungVe_, 'DET', '2026-09-19'),
    { dangDong: { '4T-02|2026-09-19|N': true }, tangCa: { '4T-03|2026-09-19': true }, chayDem: {} });
  t.bang('timDongVeGiuaCa_ tìm đúng dòng của đúng tổ (bỏ qua tổ khác), -1 nếu không có',
    [timDongVeGiuaCa_(_vungVe_, 'DET', '4T-01', '2026-09-19', 'N'),
     timDongVeGiuaCa_(_vungVe_, 'DET', 'S-01', '2026-09-19', 'N'),
     timDongVeGiuaCa_(_vungVe_, 'DET', '4T-01', '2026-09-18', 'N')],
    [2, -1, -1]);

  const _tachVe_ = tachDuLieuKeHoachTuan_(_vungVe_, 'DET', '2026-09-14');
  t.bang('tachDuLieuKeHoachTuan_ trả VE_GIUA_CA của đúng tuần/tổ ở veGiuaCaCu, tổ khác giữ nguyên',
    [_tachVe_.veGiuaCaCu.length, _tachVe_.giuLai.length], [1, 1]);
  t.bang('boVeGiuaCaBiDongDe_ lưu tuần đóng máy đúng máy-ngày-ca đó thì lượt về giữa ca bị bỏ',
    [boVeGiuaCaBiDongDe_(_tachVe_.veGiuaCaCu, [_vungVe_[2]]).length,
     boVeGiuaCaBiDongDe_(_tachVe_.veGiuaCaCu, [_vungVe_[0]]).length,
     boVeGiuaCaBiDongDe_(_tachVe_.veGiuaCaCu, []).length],
    [0, 1, 1]);

  const _plVe_ = phanLoaiDongKeHoach_([
    { Bo_Phan: 'DET', Tuan_Bat_Dau: '2026-09-14', Ma_May: '4T-01', Trang_Thai: 'VE_GIUA_CA',
      Ngay: '2026-09-19', Ca: 'N', Ly_Do: 'Nghỉ có phép', Ghi_Chu: '', Gio_Ve: '14:00', Gio_Quay_Lai: '' },
    { Bo_Phan: 'DET', Tuan_Bat_Dau: '2026-09-14', Ma_May: '4T-02', Trang_Thai: 'DONG',
      Ngay: '2026-09-18', Ca: 'N', Ly_Do: 'Thiếu thợ', Ghi_Chu: '' },
  ], 'DET', '2026-09-14');
  t.bang('phanLoaiDongKeHoach_ VE_GIUA_CA ra riêng (có giờ), KHÔNG lẫn vào ngoaiLe',
    [_plVe_.ngoaiLe.length, _plVe_.veGiuaCa],
    [1, [{ maMay: '4T-01', ngay: '2026-09-19', ca: 'N', lyDo: 'Nghỉ có phép', ghiChu: '', gioVe: '14:00', gioQuayLai: '' }]]);

  // ============================================================================
  // NGHỈ CA ĐÊM THEO TỪNG BỘ PHẬN — khoá Cau_Hinh NGHI_DEM_PHUT_<BO_PHAN>, quy đổi theo tỷ lệ
  // ============================================================================
  const _chDem_ = { NGHI_DEM_PHUT_DET: '60', NGHI_DEM_PHUT_SOI: '45', NGHI_DEM_PHUT_TRANG: '0', NGHI_DEM_PHUT_MTX: 'abc' };
  t.bang('nghiDemPhut_ mỗi bộ phận một số riêng: DET 60, SOI 45',
    [nghiDemPhut_('DET', _chDem_), nghiDemPhut_('SOI', _chDem_)], [60, 45]);
  t.bang('nghiDemPhut_ đặt 0 → không nghỉ; khoá thiếu → 0; sai định dạng → 0; bộ phận rỗng → 0',
    [nghiDemPhut_('TRANG', _chDem_), nghiDemPhut_('CMTX', _chDem_), nghiDemPhut_('MTX', _chDem_), nghiDemPhut_('', _chDem_)],
    [0, 0, 0, 0]);
  t.bang('nghiDemPhut_ không phân biệt hoa/thường, bỏ khoảng trắng đầu cuối',
    nghiDemPhut_(' det ', _chDem_), 60);
  t.bang('nghiDemPhut_ số âm → 0',
    nghiDemPhut_('DET', { NGHI_DEM_PHUT_DET: '-30' }), 0);
  t.bang('seed cấu hình có sẵn 3 bộ phận có ca đêm: DET, SOI, CMTX = 60',
    ['NGHI_DEM_PHUT_DET', 'NGHI_DEM_PHUT_SOI', 'NGHI_DEM_PHUT_CMTX'].map(function (k) {
      const r = CAU_HINH_MAC_DINH.filter(function (x) { return x[0] === k; })[0];
      return r ? r[1] : null;
    }), ['60', '60', '60']);

  t.bang('khungCaDemCuaMay_ có nghỉ 60: kế hoạch 870 − 60 = 810, độ dài ca vẫn 870, hết ca không đổi',
    (function () { const k = khungCaDemCuaMay_(_lichVe_, 60); return [k.tongPhut, k.phutKhung, k.nghiPhut, k.hetCa]; })(),
    [810, 870, 60, 1860]);
  t.bang('khungCaDemCuaMay_ nghỉ lớn hơn cả ca bị chặn, luôn còn ≥ 1 phút kế hoạch',
    khungCaDemCuaMay_(_lichVe_, 99999).tongPhut, 1);
  t.bang('khungCaDemCuaMay_ không truyền nghỉ → như cũ (870)',
    khungCaDemCuaMay_(_lichVe_).tongPhut, 870);

  t.bang('CA ĐÊM nghỉ 60: về 23:00 đến hết ca — 480 phút giao × 810/870 = 447 (quy đổi theo tỷ lệ)',
    tinhVeGiuaCa_(_lichVe_, 'D', '23:00', '', _gioMacDinh_, 60).phutMat, 447);
  t.bang('CA ĐÊM nghỉ 60: về 02:00 sáng — 300 phút giao × 810/870 = 279',
    tinhVeGiuaCa_(_lichVe_, 'D', '02:00', '', _gioMacDinh_, 60).phutMat, 279);
  t.bang('CA ĐÊM nghỉ 0 (bộ phận không nghỉ) → giữ nguyên số phút giao (480)',
    tinhVeGiuaCa_(_lichVe_, 'D', '23:00', '', _gioMacDinh_, 0).phutMat, 480);
  t.bang('CA NGÀY không bị ảnh hưởng bởi nghỉ ca đêm (vẫn 150 phút)',
    tinhVeGiuaCa_(_lichVe_, 'N', '14:00', '', _gioMacDinh_, 60).phutMat, 150);
  t.bang('ghi về giữa ca ca đêm qua chuanHoaDanhSachVeGiuaCa_ dùng đúng nghỉ của bộ phận (447)',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ ca: 'D', gioVe: '23:00' }),
      Object.assign({}, _ctxVe_, { nghiDemPhut: 60 })).ketQua, [{ maMay: '4T-01', ca: 'D', phutMat: 447 }]);
  t.bang('ghi về giữa ca ca đêm bộ phận không nghỉ (không truyền nghỉ) → 480',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ ca: 'D', gioVe: '23:00' }), _ctxVe_).ketQua,
    [{ maMay: '4T-01', ca: 'D', phutMat: 480 }]);

  // ============================================================================
  // TĂNG CA NGÀY THAY CHO CA ĐÊM — tổ có ca đêm vẫn tăng ca; máy tăng ca ngày nào thì không chạy ca đêm ngày đó
  // ============================================================================
  t.bang('máy đang tăng ca ngày đó → KHÔNG ghi được về giữa ca ĐÊM (không chạy ca đêm)',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-03'], ca: 'D', gioVe: '23:00' }), _ctxVe_).ok, false);
  t.bang('thông báo lỗi nêu rõ máy tăng ca nên không chạy ca đêm, gợi ý chọn mốc "Tăng ca"',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-03'], ca: 'D', gioVe: '23:00' }), _ctxVe_).error,
    'Máy 4T-03 tăng ca ngày 2026-09-19 nên không chạy ca đêm. Chọn mốc "Tăng ca".');
  t.bang('tổ CHAY: máy tăng ca (thợ ca ngày ở lại) cũng KHÔNG ghi được về giữa ca đêm',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-03'], ca: 'D', gioVe: '23:00' }),
      Object.assign({}, _ctxVe_, { caDemMacDinh: 'CHAY' })).ok, false);
  t.bang('máy đang tăng ca vẫn về giữa ca CA NGÀY được (tăng ca chỉ thay ca đêm)',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-03'], ca: 'N', gioVe: '16:00' }), _ctxVe_).ok, true);
  t.bang('máy KHÔNG tăng ca vẫn về giữa ca đêm bình thường',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01'], ca: 'D', gioVe: '23:00' }), _ctxVe_).ok, true);
  t.bang('máy tăng ca ngày KHÁC vẫn về giữa ca đêm ngày này được',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-03'], ca: 'D', gioVe: '23:00' }),
      Object.assign({}, _ctxVe_, { tangCa: { '4T-03|2026-09-18': true }, chayDem: { '4T-03|2026-09-19': true } })).ok, true);

  function _dongVeTC_(ma, ngay, ca, tt) {
    const r = new Array(HEADER_KE_HOACH_MAY.length).fill('');
    r[HEADER_KE_HOACH_MAY.indexOf('Ma_May')] = ma;
    r[HEADER_KE_HOACH_MAY.indexOf('Ngay')] = ngay;
    r[HEADER_KE_HOACH_MAY.indexOf('Ca')] = ca;
    r[HEADER_KE_HOACH_MAY.indexOf('Trang_Thai')] = tt;
    return r;
  }
  const _veTC_ = [
    _dongVeTC_('4T-03', '2026-09-19', 'D', 'VE_GIUA_CA'),   // ca đêm của máy sắp tăng ca → bị bỏ
    _dongVeTC_('4T-03', '2026-09-19', 'N', 'VE_GIUA_CA'),   // ca NGÀY cùng máy-ngày → giữ
    _dongVeTC_('4T-01', '2026-09-19', 'D', 'VE_GIUA_CA'),   // máy khác → giữ
    _dongVeTC_('4T-03', '2026-09-18', 'D', 'VE_GIUA_CA'),   // ngày khác → giữ
  ];
  const _tcRows_ = [_dongVeTC_('4T-03', '2026-09-19', 'N', 'TANG_CA')];
  const _chayDemRows_ = [_dongVeTC_('4T-01', '2026-09-19', 'D', 'CHAY_DEM')];
  const _khoaVe_ = function (ds) {
    return ds.map(function (r) {
      return r[HEADER_KE_HOACH_MAY.indexOf('Ma_May')] + '|' + r[HEADER_KE_HOACH_MAY.indexOf('Ngay')] + '|' + r[HEADER_KE_HOACH_MAY.indexOf('Ca')];
    });
  };
  t.bang('locVeGiuaCaTheoMoc_ tổ KHONG: lượt ĐÊM chỉ giữ khi máy-ngày chạy ca đêm và không tăng ca; ca NGÀY luôn giữ',
    _khoaVe_(locVeGiuaCaTheoMoc_(_veTC_, _tcRows_, _chayDemRows_, 'KHONG')),
    ['4T-03|2026-09-19|N', '4T-01|2026-09-19|D']);
  t.bang('locVeGiuaCaTheoMoc_ tổ KHONG không còn máy nào chạy ca đêm → chỉ còn lượt ca ngày',
    locVeGiuaCaTheoMoc_(_veTC_, [], [], 'KHONG').length, 1);
  t.bang('locVeGiuaCaTheoMoc_ tổ CHAY: ca đêm mặc định chạy, chỉ bỏ lượt đêm của máy-ngày tăng ca',
    _khoaVe_(locVeGiuaCaTheoMoc_(_veTC_, _tcRows_, [], 'CHAY')),
    ['4T-03|2026-09-19|N', '4T-01|2026-09-19|D', '4T-03|2026-09-18|D']);
  const _veMocT_ = [_dongVeTC_('4T-03', '2026-09-19', 'T', 'VE_GIUA_CA')];
  t.bang('locVeGiuaCaTheoMoc_ lượt mốc tăng ca chỉ giữ khi máy-ngày còn tăng ca',
    [locVeGiuaCaTheoMoc_(_veMocT_, _tcRows_, [], 'KHONG').length, locVeGiuaCaTheoMoc_(_veMocT_, [], [], 'KHONG').length],
    [1, 0]);

  // ============================================================================
  // CHẠY CA ĐÊM (ca đêm không cố định, mặc định không chạy) — dòng CHAY_DEM, loại trừ với tăng ca
  // ============================================================================
  t.bang('TRANG_THAI_KE_HOACH_MAY có CHAY_DEM', TRANG_THAI_KE_HOACH_MAY.CHAY_DEM, 'CHAY_DEM');
  const _cd_ = chuanHoaChayDem_({ maMay: ' 4t-08 ', ngay: '2026-09-23' }, 'det', '2026-09-21');
  t.bang('chuanHoaChayDem_ hợp lệ → ok, chuẩn hoá hoa/thường',
    [_cd_.ok, _cd_.maMay, _cd_.ngay], [true, '4T-08', '2026-09-23']);
  t.bang('dòng chạy ca đêm: Trang_Thai CHAY_DEM, Ca D, Bo_Phan hoa, không lý do',
    (function () {
      const h = HEADER_KE_HOACH_MAY; const d = _cd_.dong;
      return [d[h.indexOf('Trang_Thai')], d[h.indexOf('Ca')], d[h.indexOf('Bo_Phan')], d[h.indexOf('Ly_Do')], d.length];
    })(),
    ['CHAY_DEM', 'D', 'DET', '', HEADER_KE_HOACH_MAY.length]);
  t.bang('chuanHoaChayDem_ thiếu mã máy / ngày ngoài tuần → lỗi',
    [chuanHoaChayDem_({ ngay: '2026-09-23' }, 'DET', '2026-09-21').ok,
     chuanHoaChayDem_({ maMay: '4T-08', ngay: '2026-10-05' }, 'DET', '2026-09-21').ok], [false, false]);
  t.bang('nhãn lỗi của chuanHoaChayDem_ nói "chạy ca đêm", của chuanHoaTangCa_ vẫn nói "tăng ca"',
    [chuanHoaChayDem_({ ngay: '2026-09-23' }, 'DET', '2026-09-21').error,
     chuanHoaTangCa_({ ngay: '2026-09-23' }, 'DET', '2026-09-21').error],
    ['Thiếu mã máy (chạy ca đêm).', 'Thiếu mã máy (tăng ca).']);

  const _hopLeCd_ = { '4T-08': true, '4T-12': true };
  const _dongDemCu_ = chuanHoaDanhSachNgoaiLe_([
    { maMay: '4T-08', ngay: '2026-09-22', ca: 'D', lyDo: 'Thiếu thợ' },
  ], 'DET', '2026-09-21', _hopLeCd_, _dsLyDoGia_).dsDong;
  t.bang('chuanHoaDanhSachChayDem_ hợp lệ → ok, đủ số dòng',
    (function () {
      const r = chuanHoaDanhSachChayDem_([{ maMay: '4T-08', ngay: '2026-09-23' }, { maMay: '4T-12', ngay: '2026-09-23' }],
        'DET', '2026-09-21', _hopLeCd_, _dongDemCu_);
      return [r.ok, r.dsDong.length];
    })(), [true, 2]);
  t.bang('chuanHoaDanhSachChayDem_ danh sách rỗng / không phải mảng → ok, 0 dòng',
    [chuanHoaDanhSachChayDem_([], 'DET', '2026-09-21', _hopLeCd_, []).dsDong.length,
     chuanHoaDanhSachChayDem_(undefined, 'DET', '2026-09-21', _hopLeCd_, []).ok], [0, true]);
  t.bang('chuanHoaDanhSachChayDem_ máy thuộc tổ khác → lỗi',
    chuanHoaDanhSachChayDem_([{ maMay: 'S-01', ngay: '2026-09-23' }], 'DET', '2026-09-21', _hopLeCd_, []).ok, false);
  t.bang('chuanHoaDanhSachChayDem_ khai trùng (máy, ngày) → lỗi',
    chuanHoaDanhSachChayDem_([{ maMay: '4T-08', ngay: '2026-09-23' }, { maMay: '4t-08', ngay: '2026-09-23' }],
      'DET', '2026-09-21', _hopLeCd_, []).ok, false);
  t.bang('máy đang bị đóng CA ĐÊM (dữ liệu cũ) đúng ngày đó → không chạy ca đêm được',
    chuanHoaDanhSachChayDem_([{ maMay: '4T-08', ngay: '2026-09-22' }], 'DET', '2026-09-21', _hopLeCd_, _dongDemCu_).ok, false);
  t.bang('máy đóng ca đêm ngày KHÁC vẫn chạy ca đêm được',
    chuanHoaDanhSachChayDem_([{ maMay: '4T-08', ngay: '2026-09-23' }], 'DET', '2026-09-21', _hopLeCd_, _dongDemCu_).ok, true);

  const _tcCd_ = [_dongVeTC_('4T-08', '2026-09-23', 'N', 'TANG_CA')];
  t.bang('xungDotTangCaChayDem_ cùng máy-ngày vừa tăng ca vừa chạy ca đêm → báo lỗi',
    xungDotTangCaChayDem_(_tcCd_, [_dongVeTC_('4T-08', '2026-09-23', 'D', 'CHAY_DEM')]),
    'Máy 4T-08 ngày 2026-09-23 vừa tăng ca vừa chạy ca đêm. Chỉ chọn một: tăng ca thay cho ca đêm.');
  t.bang('xungDotTangCaChayDem_ khác ngày hoặc khác máy → không xung đột; danh sách rỗng → null',
    [xungDotTangCaChayDem_(_tcCd_, [_dongVeTC_('4T-08', '2026-09-24', 'D', 'CHAY_DEM')]),
     xungDotTangCaChayDem_(_tcCd_, [_dongVeTC_('4T-12', '2026-09-23', 'D', 'CHAY_DEM')]),
     xungDotTangCaChayDem_([], []), xungDotTangCaChayDem_(_tcCd_, undefined)], [null, null, null, null]);

  const _plCd_ = phanLoaiDongKeHoach_([
    { Bo_Phan: 'DET', Tuan_Bat_Dau: '2026-09-21', Ma_May: '4T-08', Trang_Thai: 'CHAY_DEM', Ngay: '2026-09-23', Ca: 'D' },
    { Bo_Phan: 'DET', Tuan_Bat_Dau: '2026-09-21', Ma_May: '4T-09', Trang_Thai: 'DONG', Ngay: '2026-09-22', Ca: 'N', Ly_Do: 'Thiếu thợ', Ghi_Chu: '' },
    { Bo_Phan: 'SOI', Tuan_Bat_Dau: '2026-09-21', Ma_May: 'S-01', Trang_Thai: 'CHAY_DEM', Ngay: '2026-09-23', Ca: 'D' },
  ], 'DET', '2026-09-21');
  t.bang('phanLoaiDongKeHoach_ CHAY_DEM ra riêng, KHÔNG lẫn vào ngoaiLe, lọc đúng tổ',
    [_plCd_.ngoaiLe.length, _plCd_.chayDem], [1, [{ maMay: '4T-08', ngay: '2026-09-23' }]]);

  const _vungCd_ = [
    _dongVeTC_('4T-08', '2026-09-23', 'D', 'CHAY_DEM'),
    _dongVeTC_('4T-09', '2026-09-23', 'D', 'CHAY_DEM'),
  ];
  _vungCd_.forEach(function (r) {
    r[HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau')] = '2026-09-21';
    r[HEADER_KE_HOACH_MAY.indexOf('Bo_Phan')] = 'DET';
  });
  _vungCd_[1][HEADER_KE_HOACH_MAY.indexOf('Bo_Phan')] = 'SOI';
  t.bang('tachDuLieuKeHoachTuan_ trả CHAY_DEM của đúng tổ/tuần ở chayDemCu, tổ khác giữ nguyên',
    (function () { const r = tachDuLieuKeHoachTuan_(_vungCd_, 'DET', '2026-09-21'); return [r.chayDemCu.length, r.giuLai.length]; })(),
    [1, 1]);
  t.bang('docNguCanhVeGiuaCa_ trả thêm máy đang chạy ca đêm của đúng tổ/ngày',
    docNguCanhVeGiuaCa_(_vungCd_, 'DET', '2026-09-23').chayDem, { '4T-08|2026-09-23': true });

  t.bang('về giữa ca ĐÊM chỉ ghi được khi máy đã "Chạy ca đêm" ngày đó',
    [chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01'], ca: 'D', gioVe: '23:00' }), _ctxVe_).ok,
     chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01'], ca: 'D', gioVe: '23:00' }),
       Object.assign({}, _ctxVe_, { chayDem: {} })).ok,
     chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01'], ca: 'N', gioVe: '14:00' }),
       Object.assign({}, _ctxVe_, { chayDem: {} })).ok], [true, false, true]);

  // ============================================================================
  // CHẾ ĐỘ CA ĐÊM THEO BỘ PHẬN — CA_DEM_MAC_DINH_<BO_PHAN>: CHAY (luôn chạy) / KHONG (mặc định không chạy)
  // ============================================================================
  const _chCd_ = { CA_DEM_MAC_DINH_DET: 'CHAY', CA_DEM_MAC_DINH_TRANG: 'khong', CA_DEM_MAC_DINH_SOI: ' chay ', CA_DEM_MAC_DINH_MTX: 'abc' };
  t.bang('caDemMacDinh_ DET = CHAY; giá trị viết thường/khoảng trắng vẫn nhận (SOI)',
    [caDemMacDinh_('DET', _chCd_), caDemMacDinh_('soi', _chCd_)], ['CHAY', 'CHAY']);
  t.bang('caDemMacDinh_ khoá thiếu / KHONG / giá trị lạ / bộ phận rỗng → KHONG',
    [caDemMacDinh_('ICM', _chCd_), caDemMacDinh_('TRANG', _chCd_), caDemMacDinh_('MTX', _chCd_), caDemMacDinh_('', _chCd_)],
    ['KHONG', 'KHONG', 'KHONG', 'KHONG']);
  t.bang('seed cấu hình: DET, SOI = CHAY; CMTX, TRANG không có dòng (= KHONG)',
    ['CA_DEM_MAC_DINH_DET', 'CA_DEM_MAC_DINH_SOI', 'CA_DEM_MAC_DINH_CMTX', 'CA_DEM_MAC_DINH_TRANG'].map(function (k) {
      const r = CAU_HINH_MAC_DINH.filter(function (x) { return x[0] === k; })[0];
      return r ? r[1] : null;
    }), ['CHAY', 'CHAY', null, null]);

  t.bang('chonTangCaChayDemGhi_ tổ CHAY: tăng ca dùng được (thợ ca ngày ở lại), bỏ hết "Chạy ca đêm" kể cả dữ liệu cũ',
    [chonTangCaChayDemGhi_('CHAY', true, ['tm'], ['tc'], true, ['dm'], ['dc']),
     chonTangCaChayDemGhi_('CHAY', false, [], ['tc'], false, [], ['dc'])],
    [{ tangCa: ['tm'], chayDem: [] }, { tangCa: ['tc'], chayDem: [] }]);
  t.bang('chonTangCaChayDemGhi_ tổ KHONG: client có gửi thì lấy bản mới',
    chonTangCaChayDemGhi_('KHONG', true, ['tm'], ['tc'], true, ['dm'], ['dc']), { tangCa: ['tm'], chayDem: ['dm'] });
  t.bang('chonTangCaChayDemGhi_ tổ KHONG: client cũ không gửi → giữ nguyên bản đã lưu',
    chonTangCaChayDemGhi_('KHONG', false, [], ['tc'], false, [], ['dc']), { tangCa: ['tc'], chayDem: ['dc'] });
  t.bang('chonTangCaChayDemGhi_ tổ KHONG: gửi danh sách RỖNG là xoá hết (khác với không gửi)',
    chonTangCaChayDemGhi_('KHONG', true, [], ['tc'], true, [], ['dc']), { tangCa: [], chayDem: [] });

  const _ctxChay_ = Object.assign({}, _ctxVe_, { caDemMacDinh: 'CHAY', chayDem: {} });
  t.bang('tổ CHAY: về giữa ca ĐÊM ghi được dù không có dòng "Chạy ca đêm" (ca đêm mặc định chạy)',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01'], ca: 'D', gioVe: '23:00' }), _ctxChay_).ok, true);
  t.bang('tổ CHAY: máy đã bị ĐÓNG ca đêm hôm đó thì không về giữa ca đêm được',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01'], ca: 'D', gioVe: '23:00' }),
      Object.assign({}, _ctxChay_, { dangDong: { '4T-01|2026-09-19|D': true } })).ok, false);
  t.bang('tổ KHONG (mặc định) vẫn đòi "Chạy ca đêm" như cũ',
    chuanHoaDanhSachVeGiuaCa_(_pVe_({ dsMay: ['4T-01'], ca: 'D', gioVe: '23:00' }),
      Object.assign({}, _ctxVe_, { chayDem: {} })).ok, false);

  // ============================================================================
  // Trang_Thai hợp lệ lấy từ hằng số; chế độ ca đêm có mặc định khi chưa cài đặt
  // ============================================================================
  t.bang('dsTrangThaiKeHoachMay_ có đủ 5 loại, gồm CHAY_DEM (thiếu loại này từng làm lưu "Chạy ca đêm" bị Sheets từ chối)',
    [dsTrangThaiKeHoachMay_().length, dsTrangThaiKeHoachMay_().indexOf('CHAY_DEM') !== -1],
    [Object.keys(TRANG_THAI_KE_HOACH_MAY).length, true]);
  t.bang('dsTrangThaiKeHoachMay_ chứa DONG, DA_KHAI, TANG_CA, VE_GIUA_CA, CHAY_DEM',
    dsTrangThaiKeHoachMay_().slice().sort(), ['CHAY_DEM', 'DA_KHAI', 'DONG', 'TANG_CA', 'VE_GIUA_CA']);
  t.bang('caDemMacDinh_ chưa cài đặt (khoá thiếu): DET, SOI vẫn là CHAY; CMTX là KHONG',
    [caDemMacDinh_('DET', {}), caDemMacDinh_('SOI', {}), caDemMacDinh_('CMTX', {})], ['CHAY', 'CHAY', 'KHONG']);
  t.bang('caDemMacDinh_ chưa cài đặt: TRANG, ICM, MTX vẫn là KHONG',
    [caDemMacDinh_('TRANG', {}), caDemMacDinh_('ICM', {}), caDemMacDinh_('MTX', {})], ['KHONG', 'KHONG', 'KHONG']);
  t.bang('caDemMacDinh_ ô để trống cũng dùng mặc định; gõ KHONG thì ép được KHONG',
    [caDemMacDinh_('DET', { CA_DEM_MAC_DINH_DET: '' }), caDemMacDinh_('DET', { CA_DEM_MAC_DINH_DET: 'KHONG' }),
     caDemMacDinh_('TRANG', { CA_DEM_MAC_DINH_TRANG: 'CHAY' })], ['CHAY', 'KHONG', 'CHAY']);

  // ============================================================================
  // ĐỢT 3 — HUY ĐỘNG + HIỆU SUẤT THEO TUẦN (HuyDong.gs)
  // ============================================================================
  const _tuanHd_ = '2026-09-14'; // thứ Hai; 14–20/09
  const _lichHd_ = [{ Bo_Phan: 'TO1', Ap_Dung_Tu: '2026-01-01', Ca_Ngay_Tu: '07:00', Ca_Ngay_Den: '16:30',
    Co_Nghi_Trua: true, Nghi_Trua_Tu: '11:30', Nghi_Trua_Den: '12:15', Co_Ca_Dem: false }];
  const _lichHdDem_ = [{ Bo_Phan: 'TO1', Ap_Dung_Tu: '2026-01-01', Ca_Ngay_Tu: '06:00', Ca_Ngay_Den: '18:00',
    Co_Nghi_Trua: false, Co_Ca_Dem: true, Ca_Dem_Tu: '18:00', Ca_Dem_Den: '06:00' }];
  const _mayHd_ = [{ maMay: 'M1', tenMay: 'Máy 1' }, { maMay: 'M2', tenMay: 'Máy 2' }];
  const _chToiHd_ = { CA_DEM_MAC_DINH_TO1: 'CHAY', NGHI_DEM_PHUT_TO1: '60' };
  function _khHd_(ma, ngay, tt, ca, extra) {
    return Object.assign({ Tuan_Bat_Dau: _tuanHd_, Ngay: ngay, Ca: ca || 'N', Ma_May: ma, Bo_Phan: 'TO1', Trang_Thai: tt }, extra || {});
  }
  function _dungHd_(ma, tu, den) {
    return _phieu_({ Ma_Su_Co: 'SC-' + ma + tu, Ma_May: ma, Trang_Thai_May: 'DA_DUNG',
      Thoi_Gian_Dung_May: _luc_(tu), Thoi_Gian_Hoan_Thanh: _luc_(den) }).v;
  }
  function _csHd_(o) {
    const x = o || {};
    return tinhChiSoTuan_({ boPhan: 'TO1', tuan: _tuanHd_, bayGio: x.bayGio || _luc_('2026-09-28T00:00'),
      cauHinh: x.cauHinh || {}, dsMay: _mayHd_, dsLich: x.dsLich || _lichHd_,
      dsKeHoach: x.dsKeHoach || [], dsPhieu: x.dsPhieu || [] });
  }
  const _cs0_ = _csHd_();
  t.bang('Đợt 3: không khai gì → 2 máy × 7 lượt, chạy hết, huy động = hiệu suất = 100%',
    [_cs0_.tong.luotApDung, _cs0_.tong.luotChay, _cs0_.tong.tiLeHuyDong, _cs0_.tong.hieuSuat, _cs0_.tong.phutKeHoach],
    [14, 14, 1, 1, 7350]);

  const _dongCaTuan_ = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return _khHd_('M2', ymdCongNgay_(_tuanHd_, i), 'DONG'); });
  const _cs1_ = _csHd_({ dsKeHoach: _dongCaTuan_ });
  t.bang('Đợt 3: đóng máy M2 cả tuần → huy động 50%, hiệu suất vẫn 100% (máy đóng không vào mẫu số hiệu suất)',
    [_cs1_.tong.luotChay, _cs1_.tong.tiLeHuyDong, _cs1_.tong.hieuSuat, _cs1_.tong.phutKeHoach], [7, 0.5, 1, 3675]);
  const _cs2_ = _csHd_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'DONG')] });
  t.bang('Đợt 3: đóng 1 máy 1 ngày chỉ mất đúng 1 lượt (13/14)',
    [_cs2_.tong.luotChay, _cs2_.may[0].luotChay, _cs2_.may[0].phutKeHoach], [13, 6, 6 * 525]);

  const _cs3d_ = _csHd_({ dsPhieu: [_dungHd_('M1', '2026-09-15T09:00', '2026-09-15T10:00')] });
  t.bang('Đợt 3: dừng máy 09:00–10:00 = 60 phút, hiệu suất = 1 − 60/7350',
    [_cs3d_.may[0].phutDungMay, _cs3d_.tong.hieuSuat], [60, 1 - 60 / 7350]);
  t.bang('Đợt 3: dừng xuyên nghỉ trưa 11:00–13:00 chỉ tính 30 + 45 phút ngoài nghỉ trưa',
    _csHd_({ dsPhieu: [_dungHd_('M1', '2026-09-15T11:00', '2026-09-15T13:00')] }).may[0].phutDungMay, 75);
  t.bang('Đợt 3: hai phiếu dừng chồng lấn không đếm hai lần (09:00–10:00 + 09:30–10:30 = 90)',
    _csHd_({ dsPhieu: [_dungHd_('M1', '2026-09-15T09:00', '2026-09-15T10:00'),
      _dungHd_('M1', '2026-09-15T09:30', '2026-09-15T10:30')] }).may[0].phutDungMay, 90);
  t.bang('Đợt 3: dừng vào ngày máy đã đóng không kéo hiệu suất xuống',
    _csHd_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'DONG')],
      dsPhieu: [_dungHd_('M1', '2026-09-15T09:00', '2026-09-15T10:00')] }).may[0].phutDungMay, 0);
  t.bang('Đợt 3: phiếu việc chung (CV-) không tính là dừng máy',
    _csHd_({ dsPhieu: [_phieu_({ Ma_Su_Co: 'CV-1', Loai_Phieu: LOAI_PHIEU.CONG_VIEC, Ma_May: 'M1',
      Thoi_Gian_Nhan: _luc_('2026-09-15T09:00'), Thoi_Gian_Hoan_Thanh: _luc_('2026-09-15T10:00') }).v] }).may[0].phutDungMay, 0);
  t.bang('Đợt 3: phiếu DM- (dừng máy) được tính',
    _csHd_({ dsPhieu: [_phieu_({ Ma_Su_Co: 'DM-1', Loai_Phieu: LOAI_PHIEU.DUNG_MAY, Ma_May: 'M2',
      Thoi_Gian_Dung_May: _luc_('2026-09-16T08:00'), Thoi_Gian_Hoan_Thanh: _luc_('2026-09-16T08:30') }).v] }).may[1].phutDungMay, 30);

  const _cs3_ = _csHd_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'T')] });
  t.bang('3 MỐC: tổ không ca đêm tăng ca = thêm 1 lượt chạy, thêm đúng 150 phút (18:00–20:30)',
    [_cs3_.may[0].luotApDung, _cs3_.may[0].luotChay, _cs3_.may[0].phutKeHoach], [8, 8, 7 * 525 + 150]);
  const _cs3b_ = _csHd_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'N'), _khHd_('M1', '2026-09-15', 'DONG')] });
  t.bang('3 MỐC: đóng ca ngày + tăng ca (MCQ06) → ngày đó chỉ tính 150 phút tăng ca; dòng tăng ca cũ Ca N vẫn đọc đúng',
    [_cs3b_.may[0].luotApDung, _cs3b_.may[0].luotChay, _cs3b_.may[0].phutKeHoach], [8, 7, 6 * 525 + 150]);
  const _veT_ = function (ca, gioVe) {
    return _khHd_('M1', '2026-09-15', 'VE_GIUA_CA', ca, { Gio_Ve: gioVe, Ly_Do: 'Nghỉ có phép' });
  };
  t.bang('3 MỐC: về giữa ca ở mốc tăng ca 19:00 → 90 phút; dòng cũ ghi Ca N lúc 19:00 cũng tính theo tăng ca',
    [_csHd_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'T'), _veT_('T', '19:00')] }).may[0].phutVeGiuaCa,
     _csHd_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'N'), _veT_('N', '19:00')] }).may[0].phutVeGiuaCa],
    [90, 90]);
  t.bang('3 MỐC: lượt về giữa ca mốc tăng ca mà tăng ca đã bỏ → không tính',
    _csHd_({ dsKeHoach: [_veT_('T', '19:00')] }).may[0].phutVeGiuaCa, 0);

  const _csDem_ = function (x) { return _csHd_(Object.assign({ dsLich: _lichHdDem_, cauHinh: _chToiHd_ }, x || {})); };
  t.bang('Đợt 3: tổ CHAY có ca đêm → 14 lượt/máy, kế hoạch 7×720 + 7×660 phút',
    [_csDem_().may[0].luotApDung, _csDem_().may[0].phutKeHoach], [14, 9660]);
  const _csDongDem_ = _csDem_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'DONG', 'D')] });
  t.bang('Đợt 3: tổ CHAY đóng ca đêm 1 ngày → mất đúng 1 lượt đêm',
    [_csDongDem_.may[0].luotChay, _csDongDem_.may[0].luotApDung], [13, 14]);
  const _csTcDem_ = _csDem_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'T', { Ly_Do: 'Thợ vắng ca đêm' })] });
  t.bang('3 MỐC tổ CHAY: thợ vắng ca đêm, ca ngày ở lại tăng ca → ca đêm vẫn trong kế hoạch (14 lượt, 9660 phút)',
    [_csTcDem_.may[0].luotApDung, _csTcDem_.may[0].luotChay, _csTcDem_.may[0].phutKeHoach], [14, 14, 9660]);
  t.bang('3 MỐC tổ CHAY: phần ca đêm sau 20:30 là hao hụt "Thợ vắng ca đêm" = 660 − 150 = 510 phút',
    [_csTcDem_.may[0].phutVeGiuaCa, _csTcDem_.veTheoLyDo, _csTcDem_.may[0].phutChay], [510, { 'Thợ vắng ca đêm': 510 }, 9660 - 510]);
  const _csTcDemDung_ = _csDem_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'T', { Ly_Do: 'Thợ vắng ca đêm' })],
    dsPhieu: [_dungHd_('M1', '2026-09-15T19:00', '2026-09-15T20:00')] });
  t.bang('3 MỐC tổ CHAY: máy dừng 19:00–20:00 trong giờ tăng ca tính đủ 60 phút, hao hụt ca đêm không đổi',
    [_csTcDemDung_.may[0].phutDungMay, _csTcDemDung_.may[0].phutVeGiuaCa], [60, 510]);
  const _csTcDongDem_ = _csDem_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'T'), _khHd_('M1', '2026-09-15', 'DONG', 'D')] });
  t.bang('3 MỐC tổ CHAY: đóng ca đêm theo kế hoạch + tăng ca → chỉ đoạn tăng ca vào kế hoạch, không hao hụt',
    [_csTcDongDem_.may[0].luotChay, _csTcDongDem_.may[0].phutKeHoach, _csTcDongDem_.may[0].phutVeGiuaCa],
    [14, 9660 - 660 + 150, 0]);
  t.bang('3 MỐC tổ CHAY: lượt về giữa ca ĐÊM của máy-ngày tăng ca bị bỏ qua (không tính trùng hao hụt)',
    _csDem_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'T', { Ly_Do: 'Thợ vắng ca đêm' }),
      _khHd_('M1', '2026-09-15', 'VE_GIUA_CA', 'D', { Gio_Ve: '19:00', Ly_Do: 'Nghỉ có phép' })] }).veTheoLyDo,
    { 'Thợ vắng ca đêm': 510 });
  t.bang('Đợt 3: dừng máy ban đêm quy đổi theo tỷ lệ nghỉ đêm (60 phút × 660/720 = 55)',
    _csDem_({ dsPhieu: [_dungHd_('M1', '2026-09-15T22:00', '2026-09-15T23:00')] }).may[0].phutDungMay, 55);

  const _csK_ = function (x) { return _csHd_(Object.assign({ dsLich: _lichHdDem_, cauHinh: { NGHI_DEM_PHUT_TO1: '60' } }, x || {})); };
  t.bang('Đợt 3: tổ KHONG không khai chạy đêm → chỉ 7 lượt ca ngày/máy (đêm không vào mẫu số)',
    [_csK_().may[0].luotApDung, _csK_().may[0].phutKeHoach], [7, 7 * 720]);
  const _csKDem_ = _csK_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'CHAY_DEM', 'D')] });
  t.bang('Đợt 3: tổ KHONG có CHAY_DEM 1 ngày → thêm đúng 1 lượt đêm, đã chạy',
    [_csKDem_.may[0].luotApDung, _csKDem_.may[0].luotChay], [8, 8]);
  const _csKTang_ = _csK_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'TANG_CA', 'T')] });
  t.bang('3 MỐC tổ KHONG: tăng ca là chạy thêm 150 phút, không hao hụt ca đêm',
    [_csKTang_.may[0].luotApDung, _csKTang_.may[0].phutKeHoach, _csKTang_.may[0].phutVeGiuaCa], [8, 7 * 720 + 150, 0]);

  const _ve_ = function (extra) {
    return _khHd_('M1', '2026-09-15', 'VE_GIUA_CA', 'N', Object.assign({ Gio_Ve: '14:00', Ly_Do: 'Nghỉ có phép' }, extra || {}));
  };
  const _cs4_ = _csHd_({ dsKeHoach: [_ve_()] });
  t.bang('Đợt 3: về giữa ca 14:00 tới hết ca 16:30 = 150 phút mất, ghi theo lý do',
    [_cs4_.may[0].phutVeGiuaCa, _cs4_.veTheoLyDo], [150, { 'Nghỉ có phép': 150 }]);
  const _cs5_ = _csHd_({ dsKeHoach: [_ve_()], dsPhieu: [_dungHd_('M1', '2026-09-15T14:00', '2026-09-15T15:00')] });
  t.bang('Đợt 3: về giữa ca trùng dừng máy không đếm hai lần (dừng 60 + về thêm 90)',
    [_cs5_.may[0].phutDungMay, _cs5_.may[0].phutVeGiuaCa, _cs5_.tong.phutChay], [60, 90, 7350 - 150]);
  t.bang('Đợt 3: về giữa ca có giờ quay lại 15:00 → 60 phút',
    _csHd_({ dsKeHoach: [_ve_({ Gio_Quay_Lai: '15:00' })] }).may[0].phutVeGiuaCa, 60);
  t.bang('Đợt 3: về giữa ca của lượt đã đóng máy không tính',
    _csHd_({ dsKeHoach: [_ve_(), _khHd_('M1', '2026-09-15', 'DONG')] }).may[0].phutVeGiuaCa, 0);

  const _cs6_ = _csHd_({ bayGio: _luc_('2026-09-15T12:00') });
  t.bang('Đợt 3: tuần đang diễn ra chỉ tính kế hoạch tới giờ hiện tại (525 + 270 mỗi máy)',
    [_cs6_.may[0].phutKeHoach, _cs6_.tong.tiLeHuyDong], [795, 1]);
  const _cs7_ = _csHd_({ dsLich: [] });
  t.bang('Đợt 3: tổ chưa khai lịch → không đo được (null), có cờ thiếu lịch',
    [_cs7_.thieuLich, _cs7_.tong.luotApDung, _cs7_.tong.tiLeHuyDong, _cs7_.tong.hieuSuat], [true, 0, null, null]);
  t.bang('Đợt 3: dòng kế hoạch của tổ khác / tuần khác bị bỏ qua',
    _csHd_({ dsKeHoach: [_khHd_('M1', '2026-09-15', 'DONG', 'N', { Bo_Phan: 'TO2' }),
      _khHd_('M1', '2026-09-15', 'DONG', 'N', { Tuan_Bat_Dau: '2026-09-07' })] }).tong.luotChay, 14);

  const _roll_ = tongHopChiSo_([
    { soMay: 2, luotApDung: 14, luotChay: 7, phutKeHoach: 3600, phutDungMay: 300, phutVeGiuaCa: 100, phutChay: 3200 },
    { soMay: 1, luotApDung: 7, luotChay: 7, phutKeHoach: 1800, phutDungMay: 0, phutVeGiuaCa: 0, phutChay: 1800 }]);
  t.bang('Đợt 3: cộng nhiều tổ dùng cùng công thức, không trung bình các tỷ lệ',
    [_roll_.soMay, _roll_.tiLeHuyDong, _roll_.hieuSuat], [3, 14 / 21, 5000 / 5400]);

  t.bang('Đợt 3: ymdCongNgay_ qua ranh tháng', [ymdCongNgay_('2026-09-28', 6), ymdCongNgay_('2026-12-31', 1)], ['2026-10-04', '2027-01-01']);
  t.bang('Đợt 3: tuanTuNgayNhap_ nhận dd/MM/yyyy, yyyy-MM-dd, trống = tuần này; sai → null',
    [tuanTuNgayNhap_('17/09/2026', '2026-09-21'), tuanTuNgayNhap_('2026-9-20', '2026-09-21'),
     tuanTuNgayNhap_('', '2026-09-23'), tuanTuNgayNhap_('abc', '2026-09-21'), tuanTuNgayNhap_('31/02/2026x', '2026-09-21')],
    ['2026-09-14', '2026-09-14', '2026-09-21', null, null]);

  const _bc_ = bangBaoCaoHuyDong_({ tuan: _tuanHd_, tong: _cs0_.tong, to: [_cs0_], veTheoLyDo: { 'Nghỉ có phép': 90 } }, 'x');
  t.bang('Đợt 3: bảng báo cáo — mọi dòng đủ 9 cột, có cả 2 tỷ lệ ở từng máy',
    [_bc_.bang.every(function (r) { return r.length === SO_COT_HUY_DONG; }),
     _bc_.bang.some(function (r) { return r[0] === 'M2' && r[4] === 1 && r[8] === 1; })],
    [true, true]);

  // ============================================================================
  // BÁO CÁO TUẦN 6 TỔ — lọc tổ theo Cau_Hinh, trang tóm tắt so với tuần trước
  // ============================================================================
  t.bang('Báo cáo tuần: dsToBaoCaoTuan_ trống/chưa có khoá = 6 tổ mặc định, đúng thứ tự',
    [dsToBaoCaoTuan_({}, ['CO', 'DET']), dsToBaoCaoTuan_({ BAO_CAO_TUAN_TO: '  ' }, [])],
    [['SOI', 'DET', 'ICM', 'TRANG', 'CMTX', 'MTX'], ['SOI', 'DET', 'ICM', 'TRANG', 'CMTX', 'MTX']]);
  t.bang('Báo cáo tuần: dsToBaoCaoTuan_ giữ thứ tự khai, bỏ trùng, không phân biệt hoa/thường; TAT_CA = mọi tổ có máy',
    [dsToBaoCaoTuan_({ BAO_CAO_TUAN_TO: ' det, soi ,DET,,cmtx' }, []),
     dsToBaoCaoTuan_({ BAO_CAO_TUAN_TO: 'tat_ca' }, ['SOI', 'CO', 'DET'])],
    [['DET', 'SOI', 'CMTX'], ['CO', 'DET', 'SOI']]);
  t.bang('seed cấu hình: BAO_CAO_TUAN_TO = SOI,DET,ICM,TRANG,CMTX,MTX',
    (CAU_HINH_MAC_DINH.filter(function (x) { return x[0] === 'BAO_CAO_TUAN_TO'; })[0] || [])[1],
    'SOI,DET,ICM,TRANG,CMTX,MTX');

  const _lichBc_ = ['TO1', 'TO2', 'TO3'].map(function (b) { return Object.assign({}, _lichHd_[0], { Bo_Phan: b }); });
  const _dmBc_ = [
    { Ma_May: 'A1', Ten_May: 'Máy A1', Bo_Phan: 'TO1', Hoat_Dong: true },
    { Ma_May: 'B1', Ten_May: 'Máy B1', Bo_Phan: 'TO2', Hoat_Dong: true },
    { Ma_May: 'C1', Ten_May: 'Máy C1', Bo_Phan: 'TO3', Hoat_Dong: true },
    { Ma_May: 'B2', Ten_May: 'Máy B2', Bo_Phan: 'TO2', Hoat_Dong: false }];
  const _dlBc_ = function (dsKeHoach, dsPhieu) {
    return { bayGio: _luc_('2026-09-28T00:00'), cauHinh: { BAO_CAO_TUAN_TO: 'TO2,TO1,TO9' }, dsMay: _dmBc_,
      dsLich: _lichBc_, dsKeHoach: dsKeHoach || [], dsPhieu: dsPhieu || [] };
  };
  const _dongB1_ = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
    return _khHd_('B1', ymdCongNgay_(_tuanHd_, i), 'DONG', 'N', { Bo_Phan: 'TO2' });
  });
  const _dl1_ = _dlBc_(_dongB1_.slice(0, 3), [_dungHd_('A1', '2026-09-15T09:00', '2026-09-15T11:00'),
    _dungHd_('C1', '2026-09-15T08:00', '2026-09-15T16:00')]);
  const _nm_ = chiSoToanNhaMay_(_tuanHd_, _dl1_);
  t.bang('Báo cáo tuần: chỉ các tổ khai, đúng thứ tự; tổ khai mà không có máy vẫn hiện; tổ ngoài danh sách không vào tổng',
    [_nm_.to.map(function (x) { return x.boPhan; }), _nm_.to[2].tong.soMay, _nm_.tong.soMay, _nm_.tong.luotApDung,
     _nm_.tong.phutDungMay],
    [['TO2', 'TO1', 'TO9'], 0, 2, 14, 120]);

  const _nmTruoc_ = chiSoToanNhaMay_(ymdCongNgay_(_tuanHd_, -7), _dl1_);
  const _tt_ = bangTomTatHuyDong_(_nm_, _nmTruoc_, 'x');
  const _dongTo_ = function (nhan) { return _tt_.bang.filter(function (r) { return r[0] === nhan; })[0]; };
  t.bang('Tóm tắt: mọi dòng đủ 11 cột; dòng tổng nằm ngay sau các tổ',
    [_tt_.bang.every(function (r) { return r.length === SO_COT_TOM_TAT; }),
     _tt_.bang[_tt_.dongTong - 1][0], _tt_.dongTong - _tt_.dongDauTo],
    [true, 'Tổng 3 tổ', 3]);
  t.bang('Tóm tắt: TO2 đóng máy 3/7 ngày → huy động 4/7, tuần trước 100%, chênh 4/7 − 1',
    _dongTo_('TO2').slice(2, 5), [4 / 7, 1, 4 / 7 - 1]);
  t.bang('Tóm tắt: tổ không có máy → nhãn "(không có máy)", tỷ lệ "—", chênh "—"',
    _dongTo_('TO9 (không có máy)').slice(1, 8), [0, '—', '—', '—', '—', '—', '—']);
  t.bang('Tóm tắt: máy mất giờ nhiều nhất chỉ lấy máy của các tổ báo cáo (C1 của TO3 không vào), đủ giờ',
    _tt_.bang.filter(function (r) { return /^[A-C]1 — /.test(r[0]); }).map(function (r) { return [r[0], r[1], r[2]]; }),
    [['A1 — Máy A1', 'TO1', 2]]);
  t.bang('Tóm tắt: tuần trước chưa khai lịch → cột tuần trước và chênh lệch là "—"',
    bangTomTatHuyDong_(_nm_, { tuan: '', to: [], tong: tongHopChiSo_([]) }, 'x').bang
      .filter(function (r) { return r[0] === 'TO1'; })[0].slice(3, 5),
    ['—', '—']);
  t.bang('Tóm tắt: không máy nào mất giờ → một dòng thông báo',
    bangTomTatHuyDong_(chiSoToanNhaMay_(_tuanHd_, _dlBc_()), null, 'x').bang
      .some(function (r) { return r[0] === 'Không có máy nào mất giờ.'; }), true);

  // --- Kết quả ---------------------------------------------------------------
  const tong = kq.dat + kq.loi.length;
  const bao = kq.loi.length
    ? '❌ ' + kq.loi.length + '/' + tong + ' test HỎNG\n\n' + kq.loi.join('\n\n')
    : '✅ Tất cả ' + tong + ' test đều đạt.';

  console.log(bao);
  return bao;
}

function menuChayTest() { chayVaBao_('Test logic', chayTest); }
