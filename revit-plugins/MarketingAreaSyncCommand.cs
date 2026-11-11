using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Autodesk.Revit.UI;

using View = Autodesk.Revit.DB.View;
using TaskDialog = Autodesk.Revit.UI.TaskDialog;
using Form = System.Windows.Forms.Form;
using Point = System.Drawing.Point;
using Color = System.Drawing.Color;
using Font = System.Drawing.Font;
using FontStyle = System.Drawing.FontStyle;
using Size = System.Drawing.Size;

namespace BIMXSmartTools
{
    /// <summary>
    /// M AREA - მარკეტინგის გეგმის გენერაცია.
    ///
    /// ლოგიკა:
    ///  1. საწყისი (მთავარი) გეგმიდან იკითხება ყვითელი ფილები (საცხოვრებელი ჯგუფი) და ცხრილები (Generic Annotation "ROOM").
    ///  2. ცხრილები გადააქვს მარკეტინგის გეგმაზე (ახალი ან არსებული).
    ///  3. ყოველ ყვითელ ფილას ეძებნება თავისი ცხრილი ცხრილის ლიდერის (leader) ბოლოთი -> t1 (ბინის ნომერი):
    ///     კენტი = Marketing Blue, ლუწი = Marketing green. ფილა იქმნება ზუსტად ყვითელი კონტურით.
    ///  4. ბინა იყოფა ოთახებად კედლებით: ბინის კონტურს აკლდება კედლების სისქის კონტურები
    ///     (Revit-ის Solid Boolean), ამიტომ ოთახები კედლის შიდა წახნაგებამდეა (წმინდა ფართი).
    ///  5. ყოველ ოთახზე იქმნება INVISIBLE ფილა და იწერება მისი ფართი.
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class MarketingAreaSyncCommand : IExternalCommand
    {
        public const string MAIN_LIVING_TYPE_NAME = "საცხოვრებელი ჯგუფი (სც)";
        public const string MARKETING_BLUE_TYPE_NAME = "Marketing Blue";
        public const string MARKETING_GREEN_TYPE_NAME = "Marketing green";
        public const string ROOM_INVISIBLE_TYPE_NAME = "INVISIBLE";

        public const string ANNOTATION_FAMILY_NAME = "ROOM";
        public const string ANNOTATION_TYPE_NAME = "Marketing Schedule_Archi";

        // ---- პარამეტრები ----
        private const double FT2_TO_M2 = 0.09290304;       // ft² -> მ²
        private const double MIN_ROOM_SQM = 0.5;           // ამაზე პატარა ნაჭრები (ღრიჭოები, შახტის ნაშთები) გამოტოვება
        private const int AREA_DECIMALS = 1;               // 13.9
        private const string AREA_UNIT_TEXT = "m²";        // ფოტოებზე ოთახებში "m²"-ია (შტამპებში "მ²")
        private const double MIN_SEGMENT_FT = 0.01;        // ამაზე მოკლე სეგმენტები კონტურიდან იშლება
        private const double LEADER_SNAP_FT = 2.0;         // ლიდერის ბოლო ფილიდან რამდენით შეიძლება იყოს მოშორებით
        private const double NEIGHBOR_GAP_FT = 1.5;        // ფილების "მეზობლობის" ზღვარი (აივანი <-> ბინა)
        private const double ROUNDING_FIX_SQM = 0.15;      // დამრგვალების ბალანსი უდიდეს ოთახზე (x1-თან შესაბამისობა)
        private const string GENERATED_TAG = "BIMX_MAREA";  // ტექსტებზე ნიშანი, რომ განმეორებისას წაიშალოს

        // ფოლბექ-დაყოფისთვის (თუ Solid ოპერაციები ვერ შესრულდა)
        private const double WALL_END_TOLERANCE_FT = 1.5;
        private const double MIN_SPLIT_PIECE_SQM = 0.3;

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;

            ViewPlan detectedPlan = DetectActivePlan(doc);

            var allFloorViews = new FilteredElementCollector(doc)
                .OfClass(typeof(ViewPlan))
                .Cast<ViewPlan>()
                .Where(v => !v.IsTemplate && v.ViewType != ViewType.CeilingPlan)
                .OrderBy(v => v.Name)
                .ToList();

            if (allFloorViews.Count == 0)
            {
                TaskDialog.Show("M AREA", "პროექტში სართულის გეგმები ვერ მოიძებნა.");
                return Result.Cancelled;
            }

            if (detectedPlan == null)
            {
                detectedPlan = allFloorViews.FirstOrDefault(v => v.Name.Contains("5 სართული")) ?? allFloorViews.First();
            }

            var allRegionTypes = new FilteredElementCollector(doc)
                .OfClass(typeof(FilledRegionType))
                .Cast<FilledRegionType>()
                .ToList();

            Func<string, FilledRegionType> FindType = name =>
                allRegionTypes.FirstOrDefault(t => t.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

            var mainLivingType = FindType(MAIN_LIVING_TYPE_NAME);
            var blueType = FindType(MARKETING_BLUE_TYPE_NAME);
            var greenType = FindType(MARKETING_GREEN_TYPE_NAME);
            var invisibleType = FindType(ROOM_INVISIBLE_TYPE_NAME);

            using (MarketingAreaForm form = new MarketingAreaForm(allFloorViews, detectedPlan))
            {
                if (form.ShowDialog() != DialogResult.OK)
                    return Result.Cancelled;

                if (!form.ActionGenerateMarketingRegions && !form.ActionCreateRoomRegions)
                {
                    TaskDialog.Show("M AREA", "არცერთი მოქმედება არ არის მონიშნული.");
                    return Result.Cancelled;
                }

                // საჭირო ფილის ტიპების შემოწმება
                var missing = new List<string>();
                if (mainLivingType == null) missing.Add(MAIN_LIVING_TYPE_NAME);
                if (form.ActionGenerateMarketingRegions)
                {
                    if (blueType == null) missing.Add(MARKETING_BLUE_TYPE_NAME);
                    if (greenType == null) missing.Add(MARKETING_GREEN_TYPE_NAME);
                }
                if (form.ActionCreateRoomRegions && invisibleType == null) missing.Add(ROOM_INVISIBLE_TYPE_NAME);

                if (missing.Count > 0)
                {
                    TaskDialog.Show("შეცდომა",
                        "პროექტში ვერ მოიძებნა Filled Region ტიპ(ებ)ი:\n• " + string.Join("\n• ", missing));
                    return Result.Failed;
                }

                using (Transaction t = new Transaction(doc, "BIM X - M AREA Marketing & Rooms"))
                {
                    FailureHandlingOptions failureOptions = t.GetFailureHandlingOptions();
                    failureOptions.SetFailuresPreprocessor(new WarningSwallower());
                    t.SetFailureHandlingOptions(failureOptions);

                    t.Start();
                    try
                    {
                        ViewPlan sourcePlan = form.SelectedSourcePlanView;
                        ViewPlan targetPlan = form.SelectedTargetMarketingView;
                        var log = new RunLog();

                        // ---- 1. მთავარი გეგმიდან: ყვითელი ფილები + ცხრილები ----
                        List<ApartmentItem> apartments = CollectApartments(doc, sourcePlan, mainLivingType, log);
                        if (apartments.Count == 0)
                        {
                            t.RollBack();
                            TaskDialog.Show("M AREA", "საწყის გეგმაზე \"" + sourcePlan.Name + "\" ბინის ფილა (" + MAIN_LIVING_TYPE_NAME + ") ვერ მოიძებნა.");
                            return Result.Failed;
                        }

                        List<StampInfo> stamps = ReadStamps(doc, sourcePlan);
                        if (stamps.Count == 0)
                            log.Warn("საწყის გეგმაზე ცხრილები (ოჯახი \"" + ANNOTATION_FAMILY_NAME + "\") ვერ მოიძებნა - ფერები მონაცვლეობით დაჯდება.");

                        // ---- 2. სამიზნე გეგმა ----
                        if (form.CreateNewMarketingView)
                        {
                            // Duplicate (დეტალების გარეშე): ახალ გეგმაში გადადის მხოლოდ ცხრილები
                            ElementId newViewId = sourcePlan.Duplicate(ViewDuplicateOption.Duplicate);
                            targetPlan = doc.GetElement(newViewId) as ViewPlan;
                            if (targetPlan != null)
                                targetPlan.Name = MakeUniqueViewName(doc, sourcePlan.Name + " მარკეტინგი");
                            doc.Regenerate();
                        }

                        if (targetPlan == null)
                        {
                            t.RollBack();
                            TaskDialog.Show("შეცდომა", "სამიზნე გეგმა ვერ მოიძებნა.");
                            return Result.Failed;
                        }

                        bool sameView = targetPlan.Id == sourcePlan.Id;

                        // წინა გაშვების შედეგების გასუფთავება (განმეორებისას დუბლირება რომ არ მოხდეს)
                        var generatedTypeIds = new HashSet<ElementId>();
                        if (blueType != null) generatedTypeIds.Add(blueType.Id);
                        if (greenType != null) generatedTypeIds.Add(greenType.Id);
                        if (invisibleType != null) generatedTypeIds.Add(invisibleType.Id);
                        int cleared = ClearPreviousResults(doc, targetPlan, generatedTypeIds, log);

                        // ცხრილების გადატანა მთავარი გეგმიდან მარკეტინგის გეგმაზე
                        int copiedStamps = 0;
                        if (!sameView)
                            copiedStamps = CopyStamps(doc, sourcePlan, targetPlan, stamps, log);

                        // ---- 3. ყვითელი ფილა <-> ცხრილი ----
                        AssignStamps(apartments, stamps, log);

                        apartments = apartments
                            .OrderBy(a => a.Number > 0 ? 0 : 1)
                            .ThenBy(a => a.Number)
                            .ThenByDescending(a => Math.Round(a.Centroid.Y, 1))
                            .ThenBy(a => a.Centroid.X)
                            .ToList();

                        // ---- 4. კედლები, ტექსტის ტიპი, ოთახების სახელები ----
                        List<Wall> walls = form.ActionCreateRoomRegions
                            ? new FilteredElementCollector(doc, sourcePlan.Id).OfClass(typeof(Wall)).Cast<Wall>().ToList()
                            : new List<Wall>();

                        TextNoteType textType = null;
                        double textHeight = 0.0;
                        if (form.ActionCreateRoomRegions && form.ActionWriteRoomAreaText)
                        {
                            textType = PickTextType(doc);
                            if (textType != null)
                            {
                                Parameter sizeP = textType.get_Parameter(BuiltInParameter.TEXT_SIZE);
                                if (sizeP != null) textHeight = sizeP.AsDouble() * targetPlan.Scale;
                            }
                            else log.Warn("TextNoteType ვერ მოიძებნა - ფართის წარწერა გამოტოვებულია.");
                        }

                        List<RoomNameInfo> roomNames = (textType != null && form.ActionWriteRoomNames)
                            ? ReadRoomNames(doc, sourcePlan)
                            : new List<RoomNameInfo>();

                        // ---- 5. გენერაცია ----
                        int mktCount = 0, roomRegionCount = 0, labelCount = 0, approxApts = 0, aptWithoutStamp = 0;
                        bool colorToggle = false;

                        foreach (ApartmentItem apt in apartments)
                        {
                            string aptName = apt.Number > 0 ? "ბინა " + apt.Number : "ბინა (ნომრის გარეშე)";
                            if (apt.Stamp == null) { aptWithoutStamp++; log.Warn(aptName + ": ცხრილი ვერ მოიძებნა (ფერი მონაცვლეობითია)."); }

                            // 🎨 მარკეტინგის ფილა ზუსტად ყვითელი კონტურით
                            if (form.ActionGenerateMarketingRegions)
                            {
                                bool useBlue;
                                if (apt.Number > 0) useBlue = apt.Number % 2 != 0;
                                else { useBlue = !colorToggle; colorToggle = !colorToggle; }

                                try
                                {
                                    FilledRegion.Create(doc, (useBlue ? blueType : greenType).Id, targetPlan.Id,
                                        new List<CurveLoop> { apt.OuterLoop });
                                    mktCount++;
                                }
                                catch (Exception ex)
                                {
                                    log.Warn(aptName + ": მარკეტინგის ფილა ვერ შეიქმნა - " + ex.Message);
                                }
                            }

                            // 📐 ოთახები (INVISIBLE ფილა + ფართი)
                            if (!form.ActionCreateRoomRegions) continue;

                            bool approximate;
                            List<RoomShape> rooms = BuildRooms(apt, walls, aptName, log, out approximate);
                            if (approximate) approxApts++;
                            if (rooms.Count == 0) continue;

                            rooms = rooms
                                .OrderByDescending(r => Math.Round(r.LabelPoint.Y, 1))
                                .ThenBy(r => r.LabelPoint.X)
                                .ToList();

                            ComputeDisplayAreas(rooms, apt, aptName, log);

                            foreach (RoomShape rm in rooms)
                            {
                                if (!CreateRoomRegion(doc, targetPlan, invisibleType, rm, apt.Z, aptName, log)) continue;
                                roomRegionCount++;

                                if (textType == null) continue;

                                try
                                {
                                    string text = rm.DisplayAreaSqM.ToString("F" + AREA_DECIMALS, CultureInfo.InvariantCulture) + " " + AREA_UNIT_TEXT;
                                    if (roomNames.Count > 0)
                                    {
                                        string name = FindRoomName(roomNames, rm);
                                        if (!string.IsNullOrEmpty(name)) text = name + "\n" + text;
                                    }

                                    var tOpt = new TextNoteOptions(textType.Id)
                                    {
                                        HorizontalAlignment = HorizontalTextAlignment.Center
                                    };
                                    // ტექსტი ჩასმის წერტილიდან ქვემოთ ეკიდება -> ნახევარი სიმაღლით ზევით
                                    int lines = text.Split('\n').Length;
                                    XYZ pos = new XYZ(rm.LabelPoint.X, rm.LabelPoint.Y + textHeight * 0.5 * lines, apt.Z);
                                    TextNote note = TextNote.Create(doc, targetPlan.Id, pos, text, tOpt);
                                    MarkGenerated(note);
                                    labelCount++;
                                }
                                catch (Exception ex)
                                {
                                    log.Warn(aptName + ": ფართის წარწერა ვერ შეიქმნა - " + ex.Message);
                                }
                            }
                        }

                        // თუ მარკეტინგი იმავე გეგმაზე კეთდება, ყვითელი ფილები იმალება (აღდგენადია)
                        if (sameView && form.ActionGenerateMarketingRegions && mktCount > 0)
                        {
                            try
                            {
                                var ids = apartments.Select(a => a.SourceRegion.Id).Distinct().ToList();
                                targetPlan.HideElements(ids);
                            }
                            catch (Exception ex) { log.Warn("ყვითელი ფილები ვერ დაიმალა - " + ex.Message); }
                        }

                        doc.Regenerate();
                        t.Commit();

                        try { uidoc.ActiveView = targetPlan; } catch { }

                        var sb = new StringBuilder();
                        sb.AppendLine("მარკეტინგის გეგმა მომზადდა!");
                        sb.AppendLine("• გეგმა: " + targetPlan.Name);
                        sb.AppendLine("• ნაპოვნი ბინის ფილები: " + apartments.Count + (aptWithoutStamp > 0 ? " (ცხრილის გარეშე: " + aptWithoutStamp + ")" : ""));
                        if (!sameView) sb.AppendLine("• გადმოტანილი ცხრილები: " + copiedStamps);
                        if (cleared > 0) sb.AppendLine("• წინა გაშვების ელემენტები წაიშალა: " + cleared);
                        sb.AppendLine("• მარკეტინგის ფილა (Blue/Green): " + mktCount);
                        sb.AppendLine("• ოთახის INVISIBLE ფილა: " + roomRegionCount);
                        sb.AppendLine("• ფართის წარწერა: " + labelCount);
                        if (approxApts > 0) sb.AppendLine("• ⚠ მიახლოებითი დაყოფა (კედლის ღერძებით): " + approxApts + " ბინა");
                        if (log.Warnings.Count > 0)
                        {
                            sb.AppendLine();
                            sb.AppendLine("გაფრთხილებები (" + log.Warnings.Count + "):");
                            foreach (var w in log.Warnings.Take(10)) sb.AppendLine(" - " + w);
                            if (log.Warnings.Count > 10) sb.AppendLine(" ...");
                        }
                        TaskDialog.Show("M AREA", sb.ToString());
                    }
                    catch (Exception ex)
                    {
                        t.RollBack();
                        TaskDialog.Show("შეცდომა", "ოპერაცია ვერ შესრულდა: " + ex.Message);
                        return Result.Failed;
                    }
                }
            }

            return Result.Succeeded;
        }

        // =========================================================================
        // გეგმის პოვნა / სახელი
        // =========================================================================
        private static ViewPlan DetectActivePlan(Document doc)
        {
            View activeView = doc.ActiveView;

            if (activeView is ViewPlan vp && !vp.IsTemplate && vp.ViewType != ViewType.CeilingPlan)
                return vp;

            if (activeView is ViewSheet sheet)
            {
                foreach (var vpId in sheet.GetAllViewports())
                {
                    if (doc.GetElement(vpId) is Viewport vport &&
                        doc.GetElement(vport.ViewId) is ViewPlan innerPlan &&
                        !innerPlan.IsTemplate && innerPlan.ViewType != ViewType.CeilingPlan)
                    {
                        return innerPlan;
                    }
                }
            }
            return null;
        }

        private static string MakeUniqueViewName(Document doc, string baseName)
        {
            var existing = new HashSet<string>(
                new FilteredElementCollector(doc).OfClass(typeof(ViewPlan)).Cast<ViewPlan>().Select(v => v.Name),
                StringComparer.OrdinalIgnoreCase);

            string finalName = baseName;
            int counter = 1;
            while (existing.Contains(finalName)) finalName = baseName + " (" + counter++ + ")";
            return finalName;
        }

        // =========================================================================
        // ბინები: ყვითელი ფილების გარე კონტურები
        // =========================================================================
        private static List<ApartmentItem> CollectApartments(Document doc, ViewPlan view, FilledRegionType livingType, RunLog log)
        {
            var result = new List<ApartmentItem>();

            var regions = new FilteredElementCollector(doc, view.Id)
                .OfClass(typeof(FilledRegion))
                .Cast<FilledRegion>()
                .Where(r => r.GetTypeId() == livingType.Id)
                .ToList();

            foreach (FilledRegion region in regions)
            {
                IList<CurveLoop> loops;
                try { loops = region.GetBoundaries(); }
                catch { continue; }
                if (loops == null || loops.Count == 0) continue;

                var items = new List<LoopInfo>();
                foreach (CurveLoop loop in loops)
                {
                    double z;
                    List<V2> poly = Geo.LoopToPolygon(loop, MIN_SEGMENT_FT, out z);
                    if (poly.Count < 3) continue;
                    double sa = Geo.SignedArea(poly);
                    if (Math.Abs(sa) < 1e-6) continue;
                    if (sa < 0) poly.Reverse(); // ყველა პოლიგონი CCW
                    items.Add(new LoopInfo { Loop = loop, Polygon = poly, Z = z, Area = Math.Abs(sa) });
                }

                // გარე კონტურები; სხვა კონტურის შიგნით მყოფი (ნახვრეტი) გამოიტოვება
                foreach (LoopInfo li in items)
                {
                    V2 probe = Geo.LabelPoint(li.Polygon);
                    bool isHole = items.Any(o => o != li && o.Area > li.Area && Geo.PointInPolygon(probe, o.Polygon));
                    if (isHole) continue;

                    var apt = new ApartmentItem
                    {
                        SourceRegion = region,
                        OuterLoop = li.Loop,
                        Polygon = li.Polygon,
                        Z = li.Z,
                        Centroid = Geo.Centroid(li.Polygon)
                    };
                    apt.MinX = li.Polygon.Min(p => p.X);
                    apt.MaxX = li.Polygon.Max(p => p.X);
                    apt.MinY = li.Polygon.Min(p => p.Y);
                    apt.MaxY = li.Polygon.Max(p => p.Y);
                    result.Add(apt);
                }
            }
            return result;
        }

        // =========================================================================
        // ცხრილები (Generic Annotation, ოჯახი "ROOM"): t1 = ბინის ნომერი, x1 = შიდა ფართი, x2 = ლოჯია/აივანი
        // ბინასთან მათი კავშირი ხდება ლიდერის (leader) ბოლოთი - ცხრილები შენობის გარეთაა
        // =========================================================================
        private static List<StampInfo> ReadStamps(Document doc, ViewPlan view)
        {
            var list = new List<StampInfo>();

            var all = new FilteredElementCollector(doc, view.Id)
                .OfCategory(BuiltInCategory.OST_GenericAnnotation)
                .WhereElementIsNotElementType()
                .ToElements();

            foreach (Element el in all)
            {
                ElementType et = doc.GetElement(el.GetTypeId()) as ElementType;
                if (et == null || !string.Equals(et.FamilyName, ANNOTATION_FAMILY_NAME, StringComparison.OrdinalIgnoreCase))
                    continue;

                LocationPoint lp = el.Location as LocationPoint;
                if (lp == null) continue;

                var info = new StampInfo { Element = el, Point = new V2(lp.Point.X, lp.Point.Y) };

                Parameter pT1 = el.LookupParameter("t1");
                if (pT1 != null)
                {
                    string s = pT1.AsString() ?? pT1.AsValueString() ?? "";
                    Match m = Regex.Match(s, @"\d+");
                    int n;
                    if (m.Success && int.TryParse(m.Value, out n)) info.Number = n;
                }

                info.AreaX1 = ReadAreaSqM(el.LookupParameter("x1"));
                info.AreaX2 = ReadAreaSqM(el.LookupParameter("x2"));
                info.Tips = ReadLeaderTips(el, view, info.Point);
                list.Add(info);
            }
            return list;
        }

        // "44.0 მ²", "44,0 m²" ან რიცხვითი პარამეტრი -> მ²
        private static double ReadAreaSqM(Parameter p)
        {
            if (p == null) return 0.0;

            string s = p.StorageType == StorageType.String ? p.AsString() : p.AsValueString();
            if (!string.IsNullOrWhiteSpace(s))
            {
                Match m = Regex.Match(s, @"\d+(?:[.,]\d+)?");
                double v;
                if (m.Success && double.TryParse(m.Value.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out v) && v > 0)
                    return v;
            }

            if (p.StorageType == StorageType.Double) return p.AsDouble() * FT2_TO_M2;
            return 0.0;
        }

        // ლიდერის ბოლო წერტილები: 1) API (Leaders -> End, reflection-ით, ვერსიებს შორის განსხვავების გამო),
        // 2) ცხრილის გეომეტრიის ყველაზე შორეული წერტილი
        private static List<V2> ReadLeaderTips(Element el, View view, V2 origin)
        {
            var tips = new List<V2>();

            try
            {
                object leaders = null;
                Type type = el.GetType();
                var prop = type.GetProperty("Leaders");
                if (prop != null) leaders = prop.GetValue(el, null);
                else
                {
                    var method = type.GetMethod("GetLeaders", Type.EmptyTypes);
                    if (method != null) leaders = method.Invoke(el, null);
                }

                var en = leaders as IEnumerable;
                if (en != null)
                {
                    foreach (object ld in en)
                    {
                        if (ld == null) continue;
                        var endProp = ld.GetType().GetProperty("End");
                        XYZ end = endProp != null ? endProp.GetValue(ld, null) as XYZ : null;
                        if (end != null) tips.Add(new V2(end.X, end.Y));
                    }
                }
            }
            catch { }

            if (tips.Count > 0) return tips;

            try
            {
                var opt = new Options { View = view, ComputeReferences = false, IncludeNonVisibleObjects = false };
                GeometryElement ge = el.get_Geometry(opt);
                if (ge != null)
                {
                    var pts = new List<V2>();
                    CollectGeometryPoints(ge, pts);
                    if (pts.Count > 0)
                    {
                        V2 far = pts.OrderByDescending(p => p.DistanceTo(origin)).First();
                        if (far.DistanceTo(origin) > 2.0) tips.Add(far);
                    }
                }
            }
            catch { }

            return tips;
        }

        private static void CollectGeometryPoints(IEnumerable<GeometryObject> objs, List<V2> pts)
        {
            foreach (GeometryObject go in objs)
            {
                Curve c = go as Curve;
                if (c != null)
                {
                    if (!c.IsBound) continue;
                    XYZ a = c.GetEndPoint(0), b = c.GetEndPoint(1);
                    pts.Add(new V2(a.X, a.Y));
                    pts.Add(new V2(b.X, b.Y));
                    continue;
                }

                GeometryInstance gi = go as GeometryInstance;
                if (gi != null)
                {
                    CollectGeometryPoints(gi.GetInstanceGeometry(), pts);
                }
            }
        }

        // ცხრილების კოპირება მთავარი გეგმიდან მარკეტინგის გეგმაზე (იგივე კოორდინატებზე)
        private static int CopyStamps(Document doc, ViewPlan source, ViewPlan target, List<StampInfo> stamps, RunLog log)
        {
            if (stamps.Count == 0) return 0;

            // თუ სამიზნე გეგმაზე უკვე არის ცხრილები, არ ვაკოპირებთ ხელახლა
            bool targetHasStamps = new FilteredElementCollector(doc, target.Id)
                .OfCategory(BuiltInCategory.OST_GenericAnnotation)
                .WhereElementIsNotElementType()
                .ToElements()
                .Any(e =>
                {
                    ElementType et = doc.GetElement(e.GetTypeId()) as ElementType;
                    return et != null && string.Equals(et.FamilyName, ANNOTATION_FAMILY_NAME, StringComparison.OrdinalIgnoreCase);
                });

            if (targetHasStamps)
            {
                log.Warn("მარკეტინგის გეგმაზე ცხრილები უკვე არსებობს - ხელახლა არ გადმოტანილა.");
                return 0;
            }

            try
            {
                var ids = stamps.Select(s => s.Element.Id).ToList();
                ICollection<ElementId> copied = ElementTransformUtils.CopyElements(source, ids, target, Transform.Identity, new CopyPasteOptions());
                return copied != null ? copied.Count : 0;
            }
            catch (Exception ex)
            {
                log.Warn("ცხრილების გადმოტანა ვერ მოხერხდა - " + ex.Message);
                return 0;
            }
        }

        // წინა გაშვების ფილები და ტექსტები (მხოლოდ ჩვენი ტიპები და ჩვენი ნიშნით) სამიზნე გეგმიდან
        private static int ClearPreviousResults(Document doc, ViewPlan view, HashSet<ElementId> typeIds, RunLog log)
        {
            var ids = new List<ElementId>();

            foreach (FilledRegion fr in new FilteredElementCollector(doc, view.Id).OfClass(typeof(FilledRegion)).Cast<FilledRegion>())
            {
                if (typeIds.Contains(fr.GetTypeId())) ids.Add(fr.Id);
            }

            foreach (TextNote tn in new FilteredElementCollector(doc, view.Id).OfClass(typeof(TextNote)).Cast<TextNote>())
            {
                Parameter p = tn.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS);
                if (p != null && p.AsString() == GENERATED_TAG) ids.Add(tn.Id);
            }

            if (ids.Count == 0) return 0;

            try { doc.Delete(ids); return ids.Count; }
            catch (Exception ex)
            {
                log.Warn("წინა გაშვების ელემენტები ვერ წაიშალა - " + ex.Message);
                return 0;
            }
        }

        private static void MarkGenerated(TextNote note)
        {
            try
            {
                Parameter p = note.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS);
                if (p != null && !p.IsReadOnly) p.Set(GENERATED_TAG);
            }
            catch { }
        }

        // =========================================================================
        // ცხრილების მიბმა ყვითელ ფილებზე
        // =========================================================================
        private static void AssignStamps(List<ApartmentItem> apartments, List<StampInfo> stamps, RunLog log)
        {
            // 1) ლიდერის ბოლო ეცემა ფილის შიგნით (ან მის გვერდით)
            foreach (StampInfo s in stamps)
            {
                foreach (V2 tip in s.Tips)
                {
                    ApartmentItem apt = FindApartmentAt(apartments, tip, LEADER_SNAP_FT);
                    if (apt != null && apt.Stamp == null) Attach(apt, s, false);
                }
            }

            // 2) ცხრილი, რომელსაც ლიდერით ფილა ვერ მოუძებნა: ფილა, რომლის შიგნითაცაა, ან უახლოესი თავისუფალი ფილა
            foreach (StampInfo s in stamps.Where(x => !x.Used).ToList())
            {
                ApartmentItem apt = apartments.FirstOrDefault(a => a.Stamp == null && Geo.PointInPolygon(s.Point, a.Polygon));
                if (apt == null)
                {
                    apt = apartments
                        .Where(a => a.Stamp == null)
                        .OrderBy(a => Geo.DistToPolygon(s.Point, a.Polygon))
                        .FirstOrDefault();
                    if (apt != null)
                        log.Warn("ცხრილი" + (s.Number > 0 ? " №" + s.Number : "") + ": ლიდერის ბოლო ვერ ვიპოვე, მიბმულია უახლოეს ფილაზე.");
                }
                if (apt != null) Attach(apt, s, false);
            }

            // 3) ფილა ცხრილის გარეშე (მაგ. ლოჯია/აივანი) იღებს მეზობელი ბინის ცხრილს/ფერს
            for (int pass = 0; pass < 3; pass++)
            {
                bool changed = false;
                foreach (ApartmentItem apt in apartments.Where(a => a.Stamp == null))
                {
                    ApartmentItem nb = apartments
                        .Where(o => o != apt && o.Stamp != null)
                        .Select(o => new { O = o, D = Geo.PolygonDistance(apt.Polygon, o.Polygon) })
                        .Where(x => x.D <= NEIGHBOR_GAP_FT)
                        .OrderBy(x => x.D)
                        .Select(x => x.O)
                        .FirstOrDefault();

                    if (nb != null)
                    {
                        apt.Stamp = nb.Stamp;
                        apt.Number = nb.Number;
                        apt.Inherited = true;
                        changed = true;
                    }
                }
                if (!changed) break;
            }
        }

        private static ApartmentItem FindApartmentAt(List<ApartmentItem> apartments, V2 pt, double snap)
        {
            ApartmentItem inside = apartments.FirstOrDefault(a => Geo.PointInPolygon(pt, a.Polygon));
            if (inside != null) return inside;

            var near = apartments
                .Select(a => new { A = a, D = Geo.DistToPolygon(pt, a.Polygon) })
                .Where(x => x.D <= snap)
                .OrderBy(x => x.D)
                .FirstOrDefault();
            return near != null ? near.A : null;
        }

        private static void Attach(ApartmentItem apt, StampInfo stamp, bool inherited)
        {
            stamp.Used = true;
            apt.Stamp = stamp;
            apt.Number = stamp.Number;
            apt.Inherited = inherited;
        }

        // =========================================================================
        // ოთახებად დაყოფა: ბინის კონტური მინუს კედლების სისქის კონტურები (Solid Boolean).
        // წარუმატებლობის შემთხვევაში - მიახლოებითი დაყოფა კედლის ღერძებით.
        // =========================================================================
        private List<RoomShape> BuildRooms(ApartmentItem apt, List<Wall> walls, string aptName, RunLog log, out bool approximate)
        {
            approximate = false;

            List<Wall> near = walls.Where(w =>
            {
                BoundingBoxXYZ bb = w.get_BoundingBox(null);
                if (bb == null) return false;
                return bb.Max.X >= apt.MinX && bb.Min.X <= apt.MaxX && bb.Max.Y >= apt.MinY && bb.Min.Y <= apt.MaxY;
            }).ToList();

            try
            {
                List<RoomShape> shapes = BuildRoomsFromSolids(apt, near, aptName, log);
                if (shapes.Count > 0) return shapes;
            }
            catch (Exception ex)
            {
                log.Warn(aptName + ": Solid დაყოფა ვერ შესრულდა (" + ex.Message + "), გამოიყენება მიახლოებითი დაყოფა.");
            }

            approximate = true;
            return BuildRoomsApproximate(apt, near);
        }

        private List<RoomShape> BuildRoomsFromSolids(ApartmentItem apt, List<Wall> walls, string aptName, RunLog log)
        {
            var shapes = new List<RoomShape>();
            double z0 = apt.Z;

            CurveLoop aptLoop = ToCcwLoop(apt.OuterLoop);
            Solid current = GeometryCreationUtilities.CreateExtrusionGeometry(new List<CurveLoop> { aptLoop }, XYZ.BasisZ, 1.0);

            int failed = 0;
            foreach (Wall w in walls)
            {
                CurveLoop footprint = BuildWallFootprint(w, z0 - 0.5);
                if (footprint == null) continue;

                try
                {
                    Solid wallSolid = GeometryCreationUtilities.CreateExtrusionGeometry(new List<CurveLoop> { footprint }, XYZ.BasisZ, 2.0);
                    Solid result = BooleanOperationsUtils.ExecuteBooleanOperation(current, wallSolid, BooleanOperationsType.Difference);
                    if (result != null && result.Volume > 1e-9) current = result;
                }
                catch { failed++; }
            }

            if (failed > 0 && failed * 3 > walls.Count)
                log.Warn(aptName + ": " + failed + "/" + walls.Count + " კედლის გამოკლება ვერ მოხერხდა - ოთახების კონტური ზუსტი არ იქნება.");

            IList<Solid> parts;
            try { parts = SolidUtils.SplitVolumes(current); }
            catch { parts = new List<Solid> { current }; }

            foreach (Solid part in parts)
            {
                foreach (Face face in part.Faces)
                {
                    PlanarFace pf = face as PlanarFace;
                    if (pf == null) continue;
                    if (pf.FaceNormal.Z > -0.999 || Math.Abs(pf.Origin.Z - z0) > 0.01) continue;   // მხოლოდ ქვედა წახნაგი

                    double areaSqM = pf.Area * FT2_TO_M2;
                    if (areaSqM < MIN_ROOM_SQM) continue;

                    IList<CurveLoop> loops = pf.GetEdgesAsCurveLoops();
                    if (loops == null || loops.Count == 0) continue;

                    // გარე კონტური = ყველაზე დიდი ფართის მქონე loop
                    List<V2> outer = null;
                    double outerArea = -1.0;
                    foreach (CurveLoop cl in loops)
                    {
                        double zz;
                        List<V2> poly = Geo.LoopToPolygon(cl, MIN_SEGMENT_FT, out zz);
                        if (poly.Count < 3) continue;
                        double a = Math.Abs(Geo.SignedArea(poly));
                        if (a > outerArea) { outerArea = a; outer = poly; }
                    }
                    if (outer == null) continue;
                    if (Geo.SignedArea(outer) < 0) outer.Reverse();

                    shapes.Add(new RoomShape
                    {
                        Loops = loops.ToList(),
                        Polygon = outer,
                        AreaSqM = areaSqM,
                        LabelPoint = Geo.LabelPoint(outer)
                    });
                }
            }
            return shapes;
        }

        // კედლის სისქის კონტური (ხაზოვანი კედელი ორივე ბოლოში ნახევარი სისქით გრძელდება, რომ კუთხეებში ღრიჭო არ დარჩეს)
        private static CurveLoop BuildWallFootprint(Wall w, double z)
        {
            LocationCurve lc = w.Location as LocationCurve;
            if (lc == null || lc.Curve == null || !lc.Curve.IsBound) return null;

            Curve c = lc.Curve;
            double half = Math.Max(w.Width, 0.05) * 0.5;

            Line ln = c as Line;
            if (ln != null)
            {
                XYZ p0 = ln.GetEndPoint(0), p1 = ln.GetEndPoint(1);
                double dx = p1.X - p0.X, dy = p1.Y - p0.Y;
                double len = Math.Sqrt(dx * dx + dy * dy);
                if (len < 1e-4) return null;

                double ux = dx / len, uy = dy / len;
                double nx = -uy, ny = ux;
                double ax = p0.X - ux * half, ay = p0.Y - uy * half;
                double ex = p1.X + ux * half, ey = p1.Y + uy * half;

                XYZ[] q =
                {
                    new XYZ(ax - nx * half, ay - ny * half, z),
                    new XYZ(ex - nx * half, ey - ny * half, z),
                    new XYZ(ex + nx * half, ey + ny * half, z),
                    new XYZ(ax + nx * half, ay + ny * half, z)
                };

                var loop = new CurveLoop();
                for (int i = 0; i < 4; i++) loop.Append(Line.CreateBound(q[i], q[(i + 1) % 4]));
                return loop;
            }

            try
            {
                Curve flat = c.CreateTransformed(Transform.CreateTranslation(new XYZ(0, 0, z - c.GetEndPoint(0).Z)));
                Curve o1 = flat.CreateOffset(half, XYZ.BasisZ);
                Curve o2 = flat.CreateOffset(-half, XYZ.BasisZ);

                var loop = new CurveLoop();
                loop.Append(o1);
                loop.Append(Line.CreateBound(o1.GetEndPoint(1), o2.GetEndPoint(1)));
                loop.Append(o2.CreateReversed());
                loop.Append(Line.CreateBound(o2.GetEndPoint(0), o1.GetEndPoint(0)));
                return ToCcwLoop(loop);
            }
            catch { return null; }
        }

        private static CurveLoop ToCcwLoop(CurveLoop loop)
        {
            try
            {
                if (loop.IsCounterclockwise(XYZ.BasisZ)) return loop;
                CurveLoop copy = CurveLoop.CreateViaCopy(loop);
                copy.Flip();
                return copy;
            }
            catch { return loop; }
        }

        // ფოლბექი: კედლის ღერძებით დაყოფა (Geo.Partition)
        private List<RoomShape> BuildRoomsApproximate(ApartmentItem apt, List<Wall> walls)
        {
            var segs = new List<WallSeg>();
            foreach (Wall w in walls)
            {
                LocationCurve lc = w.Location as LocationCurve;
                Line line = lc != null ? lc.Curve as Line : null;
                if (line == null) continue;
                XYZ p0 = line.GetEndPoint(0), p1 = line.GetEndPoint(1);
                segs.Add(new WallSeg(new V2(p0.X, p0.Y), new V2(p1.X, p1.Y)));
            }

            List<List<V2>> pieces = Geo.Partition(apt.Polygon, segs, WALL_END_TOLERANCE_FT, MIN_SPLIT_PIECE_SQM / FT2_TO_M2);
            var shapes = new List<RoomShape>();

            foreach (var piece in pieces)
            {
                List<V2> clean = Geo.Clean(piece, MIN_SEGMENT_FT, 0.002);
                if (clean.Count < 3) continue;
                double a = Math.Abs(Geo.SignedArea(clean)) * FT2_TO_M2;
                if (a < MIN_ROOM_SQM) continue;
                if (Geo.SignedArea(clean) < 0) clean.Reverse();

                shapes.Add(new RoomShape
                {
                    Loops = new List<CurveLoop> { Geo.ToCurveLoop(clean, apt.Z) },
                    Polygon = clean,
                    AreaSqM = a,
                    LabelPoint = Geo.LabelPoint(clean)
                });
            }
            return shapes;
        }

        // INVISIBLE ფილა ოთახზე; თუ რკალიანი კონტური ვერ შეიქმნა, მრავალკუთხედით
        private static bool CreateRoomRegion(Document doc, ViewPlan view, FilledRegionType type, RoomShape rm, double z, string aptName, RunLog log)
        {
            try
            {
                FilledRegion.Create(doc, type.Id, view.Id, rm.Loops);
                return true;
            }
            catch
            {
                try
                {
                    List<V2> clean = Geo.Clean(rm.Polygon, MIN_SEGMENT_FT, 0.002);
                    FilledRegion.Create(doc, type.Id, view.Id, new List<CurveLoop> { Geo.ToCurveLoop(clean, z) });
                    return true;
                }
                catch (Exception ex)
                {
                    log.Warn(aptName + ": ოთახის ფილა ვერ შეიქმნა - " + ex.Message);
                    return false;
                }
            }
        }

        // =========================================================================
        // ფართები: ყოველი ოთახი ცალ-ცალკე მრგვალდება (როგორც Revit-ის ოთახის ტეგი),
        // ჯამი კი თუ ≤0.15 მ²-ით განსხვავდება ცხრილის x1 (ან x1+x2) მნიშვნელობისგან, სხვაობა უდიდეს ოთახს ემატება
        // =========================================================================
        private static void ComputeDisplayAreas(List<RoomShape> rooms, ApartmentItem apt, string aptName, RunLog log)
        {
            foreach (RoomShape r in rooms)
                r.DisplayAreaSqM = Math.Round(r.AreaSqM, AREA_DECIMALS, MidpointRounding.AwayFromZero);

            if (apt.Stamp == null || apt.Inherited || apt.Stamp.AreaX1 <= 0) return;

            double sum = rooms.Sum(r => r.DisplayAreaSqM);
            var candidates = new List<double> { apt.Stamp.AreaX1 };
            if (apt.Stamp.AreaX2 > 0) candidates.Add(apt.Stamp.AreaX1 + apt.Stamp.AreaX2);

            double best = candidates.OrderBy(c => Math.Abs(sum - c)).First();
            double diff = Math.Round(best - sum, 2);

            if (Math.Abs(diff) < 0.0001) return;

            if (Math.Abs(diff) <= ROUNDING_FIX_SQM)
            {
                RoomShape largest = rooms.OrderByDescending(r => r.AreaSqM).First();
                largest.DisplayAreaSqM = Math.Round(largest.DisplayAreaSqM + diff, AREA_DECIMALS, MidpointRounding.AwayFromZero);
            }
            else
            {
                log.Warn(aptName + ": ოთახების ჯამი " + sum.ToString("0.0", CultureInfo.InvariantCulture) +
                         " მ², ცხრილში x1 = " + apt.Stamp.AreaX1.ToString("0.0", CultureInfo.InvariantCulture) + " მ² - შეამოწმე.");
            }
        }

        private static TextNoteType PickTextType(Document doc)
        {
            var types = new FilteredElementCollector(doc).OfClass(typeof(TextNoteType)).Cast<TextNoteType>().ToList();
            return types.FirstOrDefault(t => t.Name.Contains("2.5") || t.Name.Contains("2,5")) ?? types.FirstOrDefault();
        }

        // =========================================================================
        // ოთახის სახელები (არასავალდებულო): Revit-ის Room-ებიდან
        // =========================================================================
        private static List<RoomNameInfo> ReadRoomNames(Document doc, ViewPlan view)
        {
            var list = new List<RoomNameInfo>();
            ElementId levelId = view.GenLevel != null ? view.GenLevel.Id : ElementId.InvalidElementId;

            foreach (Element e in new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Rooms).WhereElementIsNotElementType())
            {
                Room room = e as Room;
                if (room == null || room.Area <= 0) continue;
                if (levelId != ElementId.InvalidElementId && room.LevelId != levelId) continue;

                LocationPoint lp = room.Location as LocationPoint;
                if (lp == null) continue;

                Parameter np = room.get_Parameter(BuiltInParameter.ROOM_NAME);
                string name = np != null ? np.AsString() : null;
                if (string.IsNullOrWhiteSpace(name)) continue;

                list.Add(new RoomNameInfo { Point = new V2(lp.Point.X, lp.Point.Y), Name = name.Trim() });
            }
            return list;
        }

        private static string FindRoomName(List<RoomNameInfo> names, RoomShape shape)
        {
            return names
                .Where(n => Geo.PointInPolygon(n.Point, shape.Polygon))
                .OrderBy(n => n.Point.DistanceTo(shape.LabelPoint))
                .Select(n => n.Name)
                .FirstOrDefault();
        }

        private class WarningSwallower : IFailuresPreprocessor
        {
            public FailureProcessingResult PreprocessFailures(FailuresAccessor failuresAccessor)
            {
                var failureList = failuresAccessor.GetFailureMessages();
                foreach (var failure in failureList)
                {
                    if (failure.GetSeverity() == FailureSeverity.Warning)
                    {
                        failuresAccessor.DeleteWarning(failure);
                    }
                }
                return FailureProcessingResult.Continue;
            }
        }
    }

    // =========================================================================
    // მონაცემთა კლასები
    // =========================================================================
    internal class RunLog
    {
        public List<string> Warnings = new List<string>();
        public void Warn(string s) { Warnings.Add(s); }
    }

    internal class LoopInfo
    {
        public CurveLoop Loop;
        public List<V2> Polygon;
        public double Z;
        public double Area;
    }

    internal class StampInfo
    {
        public Element Element;
        public V2 Point;
        public List<V2> Tips = new List<V2>();
        public int Number;
        public double AreaX1;
        public double AreaX2;
        public bool Used;
    }

    internal class ApartmentItem
    {
        public FilledRegion SourceRegion;
        public CurveLoop OuterLoop;
        public List<V2> Polygon;
        public double Z;
        public V2 Centroid;
        public double MinX, MinY, MaxX, MaxY;
        public StampInfo Stamp;
        public bool Inherited;      // ცხრილი მეზობელი ფილიდანაა აღებული (აივანი/ლოჯია)
        public int Number;
    }

    internal class RoomShape
    {
        public List<CurveLoop> Loops;
        public List<V2> Polygon;        // გარე კონტური (CCW), წარწერის წერტილისთვის
        public double AreaSqM;          // ზუსტი ფართი
        public double DisplayAreaSqM;   // დამრგვალებული, წარწერისთვის
        public V2 LabelPoint;
    }

    internal class RoomNameInfo
    {
        public V2 Point;
        public string Name;
    }

    internal struct V2
    {
        public double X, Y;
        public V2(double x, double y) { X = x; Y = y; }
        public double DistanceTo(V2 o) { double dx = X - o.X, dy = Y - o.Y; return Math.Sqrt(dx * dx + dy * dy); }
    }

    internal class WallSeg
    {
        public V2 A, B;
        public WallSeg(V2 a, V2 b) { A = a; B = b; }
    }

    // =========================================================================
    // 2D გეომეტრია (Revit-ისგან დამოუკიდებელი)
    // =========================================================================
    internal static class Geo
    {
        private const double Eps = 1e-6;

        private struct Node { public V2 P; public bool OnLine; }
        private struct Cut { public double S; public int Index; }

        public static double SignedArea(IList<V2> p)
        {
            double s = 0.0;
            for (int i = 0; i < p.Count; i++)
            {
                V2 a = p[i], b = p[(i + 1) % p.Count];
                s += a.X * b.Y - b.X * a.Y;
            }
            return s * 0.5;
        }

        public static V2 Centroid(IList<V2> p)
        {
            double a = SignedArea(p);
            if (Math.Abs(a) < 1e-12)
                return new V2(p.Average(q => q.X), p.Average(q => q.Y));

            double cx = 0.0, cy = 0.0;
            for (int i = 0; i < p.Count; i++)
            {
                V2 u = p[i], v = p[(i + 1) % p.Count];
                double cr = u.X * v.Y - v.X * u.Y;
                cx += (u.X + v.X) * cr;
                cy += (u.Y + v.Y) * cr;
            }
            return new V2(cx / (6.0 * a), cy / (6.0 * a));
        }

        public static bool PointInPolygon(V2 pt, IList<V2> poly)
        {
            bool inside = false;
            for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
            {
                V2 pi = poly[i], pj = poly[j];
                if ((pi.Y > pt.Y) != (pj.Y > pt.Y) &&
                    pt.X < (pj.X - pi.X) * (pt.Y - pi.Y) / (pj.Y - pi.Y) + pi.X)
                    inside = !inside;
            }
            return inside;
        }

        public static double DistToSegment(V2 p, V2 a, V2 b)
        {
            double dx = b.X - a.X, dy = b.Y - a.Y;
            double l2 = dx * dx + dy * dy;
            double t = l2 < 1e-18 ? 0.0 : Math.Max(0.0, Math.Min(1.0, ((p.X - a.X) * dx + (p.Y - a.Y) * dy) / l2));
            double ex = p.X - (a.X + t * dx), ey = p.Y - (a.Y + t * dy);
            return Math.Sqrt(ex * ex + ey * ey);
        }

        public static double DistToPolygon(V2 p, IList<V2> poly)
        {
            double d = double.MaxValue;
            for (int i = 0; i < poly.Count; i++)
                d = Math.Min(d, DistToSegment(p, poly[i], poly[(i + 1) % poly.Count]));
            return d;
        }

        // ორი პოლიგონის კონტურებს შორის მინიმალური მანძილი (0 თუ ეხებიან/იკვეთებიან)
        public static double PolygonDistance(IList<V2> a, IList<V2> b)
        {
            double d = double.MaxValue;
            foreach (V2 p in a) d = Math.Min(d, DistToPolygon(p, b));
            foreach (V2 p in b) d = Math.Min(d, DistToPolygon(p, a));
            return d;
        }

        // წერტილი ოთახის შიგნით წარწერისთვის: ცენტროიდი, ხოლო არაამოზნექილ ფორმაში (L-ფორმა) - ყველაზე განიერი ჰორიზონტალური მონაკვეთის შუა
        public static V2 LabelPoint(IList<V2> poly)
        {
            V2 c = Centroid(poly);
            if (PointInPolygon(c, poly) && DistToPolygon(c, poly) > 1e-3) return c;

            var xs = new List<double>();
            for (int i = 0; i < poly.Count; i++)
            {
                V2 a = poly[i], b = poly[(i + 1) % poly.Count];
                if ((a.Y > c.Y) != (b.Y > c.Y))
                    xs.Add(a.X + (c.Y - a.Y) / (b.Y - a.Y) * (b.X - a.X));
            }
            xs.Sort();

            double bestW = -1.0;
            V2 best = new V2(poly.Average(q => q.X), poly.Average(q => q.Y));
            for (int k = 0; k + 1 < xs.Count; k += 2)
            {
                double w = xs[k + 1] - xs[k];
                if (w > bestW) { bestW = w; best = new V2((xs[k] + xs[k + 1]) * 0.5, c.Y); }
            }
            return best;
        }

        // მეზობელი დუბლირებული და კოლინეარული წვეროების მოშორება
        public static List<V2> Clean(IList<V2> pts, double minLen, double collinearTol)
        {
            var p = new List<V2>(pts);
            bool changed = true;
            int guard = 0;
            while (changed && p.Count >= 3 && guard++ < 1000)
            {
                changed = false;
                for (int i = 0; i < p.Count; i++)
                {
                    V2 prev = p[(i + p.Count - 1) % p.Count];
                    V2 cur = p[i];
                    V2 next = p[(i + 1) % p.Count];

                    if (cur.DistanceTo(prev) < minLen || DistToSegment(cur, prev, next) < collinearTol)
                    {
                        p.RemoveAt(i);
                        changed = true;
                        break;
                    }
                }
            }
            return p;
        }

        // CurveLoop -> პოლიგონი (რკალები იყოფა მონაკვეთებად)
        public static List<V2> LoopToPolygon(CurveLoop loop, double minLen, out double z)
        {
            var pts = new List<V2>();
            z = 0.0;
            bool zSet = false;

            foreach (Curve c in loop)
            {
                IList<XYZ> tess = c.Tessellate();
                if (tess == null || tess.Count < 2) continue;
                if (!zSet) { z = tess[0].Z; zSet = true; }

                var seg = tess.Select(q => new V2(q.X, q.Y)).ToList();
                if (pts.Count > 0 && pts[pts.Count - 1].DistanceTo(seg[0]) > pts[pts.Count - 1].DistanceTo(seg[seg.Count - 1]))
                    seg.Reverse();

                int start = pts.Count == 0 ? 0 : 1;
                for (int i = start; i < seg.Count; i++) pts.Add(seg[i]);
            }

            if (pts.Count > 1 && pts[0].DistanceTo(pts[pts.Count - 1]) < minLen)
                pts.RemoveAt(pts.Count - 1);

            return Clean(pts, minLen, 1e-4);
        }

        public static CurveLoop ToCurveLoop(IList<V2> poly, double z)
        {
            var loop = new CurveLoop();
            for (int i = 0; i < poly.Count; i++)
            {
                V2 a = poly[i], b = poly[(i + 1) % poly.Count];
                loop.Append(Line.CreateBound(new XYZ(a.X, a.Y, z), new XYZ(b.X, b.Y, z)));
            }
            return loop;
        }

        // =====================================================================
        // ფოლბექი: პოლიგონის დაყოფა კედლის ღერძებით. კედელი პოლიგონს ჰყოფს მხოლოდ მაშინ,
        // თუ მისი ხაზი პოლიგონს კონტურიდან კონტურამდე (ან უკვე გაჭრილ ხაზამდე) მთლიანად კვეთს
        // =====================================================================
        public static List<List<V2>> Partition(List<V2> poly, List<WallSeg> walls, double endTol, double minPieceArea)
        {
            var work = new Stack<List<V2>>();
            work.Push(poly);
            var result = new List<List<V2>>();
            int guard = 0;

            while (work.Count > 0 && guard++ < 2000)
            {
                List<V2> p = work.Pop();
                bool split = false;

                foreach (WallSeg w in walls)
                {
                    List<V2> p1, p2;
                    if (TrySplit(p, w.A, w.B, endTol, 0.3, minPieceArea, out p1, out p2))
                    {
                        work.Push(p1);
                        work.Push(p2);
                        split = true;
                        break;
                    }
                }
                if (!split) result.Add(p);
            }
            return result;
        }

        private static bool TrySplit(List<V2> poly, V2 a, V2 b, double endTol, double minChord, double minPieceArea,
                                     out List<V2> p1, out List<V2> p2)
        {
            p1 = null; p2 = null;

            double dx = b.X - a.X, dy = b.Y - a.Y;
            double len = Math.Sqrt(dx * dx + dy * dy);
            if (len < 1e-6) return false;

            double ux = dx / len, uy = dy / len;     // ხაზის მიმართულება
            double nx = -uy, ny = ux;                // ნორმალი

            int n = poly.Count;
            var dist = new double[n];
            var sign = new int[n];
            for (int i = 0; i < n; i++)
            {
                dist[i] = (poly[i].X - a.X) * nx + (poly[i].Y - a.Y) * ny;
                sign[i] = Math.Abs(dist[i]) < Eps ? 0 : (dist[i] > 0 ? 1 : -1);
            }

            // წვეროები + ხაზთან გადაკვეთის წერტილები
            var nodes = new List<Node>();
            for (int i = 0; i < n; i++)
            {
                int j = (i + 1) % n;
                nodes.Add(new Node { P = poly[i], OnLine = sign[i] == 0 });
                if (sign[i] * sign[j] < 0)
                {
                    double t = dist[i] / (dist[i] - dist[j]);
                    nodes.Add(new Node
                    {
                        P = new V2(poly[i].X + t * (poly[j].X - poly[i].X), poly[i].Y + t * (poly[j].Y - poly[i].Y)),
                        OnLine = true
                    });
                }
            }

            var cuts = new List<Cut>();
            for (int i = 0; i < nodes.Count; i++)
            {
                if (!nodes[i].OnLine) continue;
                cuts.Add(new Cut { S = (nodes[i].P.X - a.X) * ux + (nodes[i].P.Y - a.Y) * uy, Index = i });
            }
            cuts.Sort((c1, c2) => c1.S.CompareTo(c2.S));

            for (int k = 0; k + 1 < cuts.Count; k++)
            {
                Cut c0 = cuts[k], c1 = cuts[k + 1];

                if (c1.S - c0.S < minChord) continue;                       // ძალიან მოკლე
                if (c0.S < -endTol || c1.S > len + endTol) continue;        // კედელი მთლიანად არ ფარავს მონაკვეთს

                V2 pa = nodes[c0.Index].P, pb = nodes[c1.Index].P;
                V2 mid = new V2((pa.X + pb.X) * 0.5, (pa.Y + pb.Y) * 0.5);
                if (!PointInPolygon(mid, poly) || DistToPolygon(mid, poly) < 1e-3) continue; // მონაკვეთი კონტურის გასწვრივაა / გარეთაა

                int lo = Math.Min(c0.Index, c1.Index), hi = Math.Max(c0.Index, c1.Index);

                var q1 = new List<V2>();
                for (int i = lo; i <= hi; i++) q1.Add(nodes[i].P);

                var q2 = new List<V2>();
                for (int i = hi; i < nodes.Count; i++) q2.Add(nodes[i].P);
                for (int i = 0; i <= lo; i++) q2.Add(nodes[i].P);

                if (q1.Count < 3 || q2.Count < 3) continue;
                if (Math.Abs(SignedArea(q1)) < minPieceArea || Math.Abs(SignedArea(q2)) < minPieceArea) continue;

                p1 = q1; p2 = q2;
                return true;
            }
            return false;
        }
    }

    // =========================================================================
    // 🖥 UI დიალოგი
    // =========================================================================
    public class MarketingAreaForm : Form
    {
        public bool CreateNewMarketingView => rbCreateNewView.Checked;
        public bool ActionGenerateMarketingRegions => chkGenerateMkt.Checked;
        public bool ActionCreateRoomRegions => chkCreateRoomRegions.Checked;
        public bool ActionWriteRoomAreaText => chkCreateRoomRegions.Checked && chkWriteRoomAreaText.Checked;
        public bool ActionWriteRoomNames => ActionWriteRoomAreaText && chkWriteRoomNames.Checked;

        public ViewPlan SelectedSourcePlanView => cmbSourceView.SelectedItem as ViewPlan;
        public ViewPlan SelectedTargetMarketingView => rbUseExistingView.Checked ? (cmbTargetView.SelectedItem as ViewPlan) : null;

        private System.Windows.Forms.ComboBox cmbSourceView;
        private System.Windows.Forms.ComboBox cmbTargetView;
        private System.Windows.Forms.RadioButton rbCreateNewView;
        private System.Windows.Forms.RadioButton rbUseExistingView;
        private System.Windows.Forms.CheckBox chkGenerateMkt;
        private System.Windows.Forms.CheckBox chkCreateRoomRegions;
        private System.Windows.Forms.CheckBox chkWriteRoomAreaText;
        private System.Windows.Forms.CheckBox chkWriteRoomNames;
        private System.Windows.Forms.Button btnExecute;
        private System.Windows.Forms.Button btnCancel;

        public MarketingAreaForm(List<ViewPlan> allFloorViews, ViewPlan detectedPlan)
        {
            this.Text = "BIM X - M AREA (სუფთა მარკეტინგის გეგმა & ოთახები)";
            this.Size = new Size(630, 520);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;

            int y = 12;

            System.Windows.Forms.Panel infoPnl = new System.Windows.Forms.Panel() { Location = new Point(15, y), Size = new Size(580, 68), BackColor = Color.FromArgb(240, 245, 255), BorderStyle = BorderStyle.FixedSingle };
            infoPnl.Controls.Add(new System.Windows.Forms.Label() { Text = $"✔ ძირითადი ფილა: {MarketingAreaSyncCommand.MAIN_LIVING_TYPE_NAME}\n✔ მარკეტინგის ფილა: {MarketingAreaSyncCommand.MARKETING_BLUE_TYPE_NAME} & {MarketingAreaSyncCommand.MARKETING_GREEN_TYPE_NAME}\n✔ ოთახების ფილა: {MarketingAreaSyncCommand.ROOM_INVISIBLE_TYPE_NAME} | შტამპი: {MarketingAreaSyncCommand.ANNOTATION_FAMILY_NAME}", Location = new Point(10, 6), AutoSize = true, Font = new Font("Arial", 8.5f, FontStyle.Bold), ForeColor = Color.FromArgb(30, 60, 120) });
            this.Controls.Add(infoPnl);

            y += 78;

            this.Controls.Add(new System.Windows.Forms.Label() { Text = "საწყისი გეგმა (ყვითელი ფილები & ცხრილები):", Location = new Point(15, y + 3), AutoSize = true, Font = new Font("Arial", 9f, FontStyle.Bold) });
            cmbSourceView = new System.Windows.Forms.ComboBox() { Location = new Point(285, y), Width = 310, DropDownStyle = ComboBoxStyle.DropDownList, DisplayMember = "Name" };
            foreach (var v in allFloorViews) cmbSourceView.Items.Add(v);
            int srcIdx = allFloorViews.FindIndex(v => v.Id == detectedPlan.Id);
            cmbSourceView.SelectedIndex = srcIdx >= 0 ? srcIdx : 0;
            this.Controls.Add(cmbSourceView);

            y += 36;

            rbCreateNewView = new System.Windows.Forms.RadioButton()
            {
                Text = "✨ ახალი მარკეტინგის გეგმის შექმნა (გადმოაქვს მხოლოდ ცხრილები)",
                Location = new Point(18, y),
                AutoSize = true,
                Font = new Font("Arial", 9.5f, FontStyle.Bold),
                ForeColor = Color.DarkMagenta,
                Checked = true
            };
            rbCreateNewView.CheckedChanged += (s, e) => cmbTargetView.Enabled = rbUseExistingView.Checked;
            this.Controls.Add(rbCreateNewView);

            y += 28;

            rbUseExistingView = new System.Windows.Forms.RadioButton()
            {
                Text = "არსებულ მარკეტინგის გეგმაში გადატანა:",
                Location = new Point(18, y),
                AutoSize = true,
                Font = new Font("Arial", 9f),
                Checked = false
            };
            rbUseExistingView.CheckedChanged += (s, e) => cmbTargetView.Enabled = rbUseExistingView.Checked;
            this.Controls.Add(rbUseExistingView);

            cmbTargetView = new System.Windows.Forms.ComboBox() { Location = new Point(285, y - 2), Width = 310, DropDownStyle = ComboBoxStyle.DropDownList, DisplayMember = "Name", Enabled = false };
            foreach (var v in allFloorViews) cmbTargetView.Items.Add(v);
            int targetIdx = allFloorViews.FindIndex(v => v.Name.ToLower().Contains("მარკეტინგი") || v.Name.ToLower().Contains("marketing"));
            cmbTargetView.SelectedIndex = targetIdx >= 0 ? targetIdx : (srcIdx >= 0 ? srcIdx : 0);
            this.Controls.Add(cmbTargetView);

            y += 40;

            chkGenerateMkt = new System.Windows.Forms.CheckBox()
            {
                Text = "🎨 მარკეტინგის ფილების შექმნა ცხრილების მიხედვით (კენტი=Blue, ლუწი=Green)",
                Location = new Point(20, y),
                AutoSize = true,
                Font = new Font("Arial", 9.5f, FontStyle.Bold),
                ForeColor = Color.DarkBlue,
                Checked = true
            };
            this.Controls.Add(chkGenerateMkt);

            y += 28;

            chkCreateRoomRegions = new System.Windows.Forms.CheckBox()
            {
                Text = "📐 ოთახებად დაყოფა კედლებით (INVISIBLE ფილები)",
                Location = new Point(20, y),
                AutoSize = true,
                Font = new Font("Arial", 9.5f, FontStyle.Bold),
                ForeColor = Color.DarkGreen,
                Checked = true
            };
            chkCreateRoomRegions.CheckedChanged += (s, e) =>
            {
                chkWriteRoomAreaText.Enabled = chkCreateRoomRegions.Checked;
                chkWriteRoomNames.Enabled = chkCreateRoomRegions.Checked && chkWriteRoomAreaText.Checked;
            };
            this.Controls.Add(chkCreateRoomRegions);

            y += 28;

            chkWriteRoomAreaText = new System.Windows.Forms.CheckBox()
            {
                Text = "✍️ ოთახებში ფართობის დაწერა (მაგ: 13.9 m²)",
                Location = new Point(20, y),
                AutoSize = true,
                Font = new Font("Arial", 9.5f, FontStyle.Bold),
                ForeColor = Color.DarkSlateGray,
                Checked = true
            };
            chkWriteRoomAreaText.CheckedChanged += (s, e) =>
                chkWriteRoomNames.Enabled = chkCreateRoomRegions.Checked && chkWriteRoomAreaText.Checked;
            this.Controls.Add(chkWriteRoomAreaText);

            y += 28;

            chkWriteRoomNames = new System.Windows.Forms.CheckBox()
            {
                Text = "🏷 ფართთან ერთად ოთახის სახელიც (Revit Room-დან; თუ გეგმაზე Room Tag-ები უკვე გაქვს, გამორთე)",
                Location = new Point(40, y),
                AutoSize = true,
                Font = new Font("Arial", 8.5f),
                ForeColor = Color.DimGray,
                Checked = false
            };
            this.Controls.Add(chkWriteRoomNames);

            y += 40;

            btnExecute = new System.Windows.Forms.Button()
            {
                Text = "⚡ M AREA სინქრონიზაცია და გენერაცია",
                Location = new Point(20, y),
                Size = new Size(390, 44),
                BackColor = Color.LightGreen,
                Font = new Font("Arial", 10f, FontStyle.Bold),
                Cursor = Cursors.Hand,
                DialogResult = DialogResult.OK
            };
            this.Controls.Add(btnExecute);

            btnCancel = new System.Windows.Forms.Button()
            {
                Text = "გაუქმება",
                Location = new Point(425, y),
                Size = new Size(170, 44),
                BackColor = Color.LightGray,
                Font = new Font("Arial", 9.5f),
                Cursor = Cursors.Hand,
                DialogResult = DialogResult.Cancel
            };
            this.Controls.Add(btnCancel);

            this.AcceptButton = btnExecute;
            this.CancelButton = btnCancel;
        }
    }
}
